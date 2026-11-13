# Railway backend deployment plan: FastEmbed/ONNX migration

## Purpose

Deploy the FastAPI backend from `backend/` to Railway while fitting within a 512 MB RAM limit. The only ML-runtime migration is:

- remove PyTorch and `sentence-transformers`;
- use FastEmbed and ONNX Runtime for dense embeddings and cross-encoder reranking;
- preserve the current RAG behavior, database schema, vector dimension, retrieval stages, and response contracts.

## Implementation status

Implemented and locally verified on November 13, 2026. Railway deployment itself remains a manual user step.

Verification results:

- old and ONNX embedding outputs: 384 dimensions with minimum cosine similarity above `0.99999999`;
- ten existing Supabase vectors versus fresh ONNX vectors: minimum cosine similarity `0.9999999999993945`;
- dense retrieval and reranker ordering: unchanged in the compatibility fixtures;
- old runtime packages/imports: absent from source, lockfile, and resolved dependency tree;
- local API `/health`, `/docs`, and CORS preflight: passed;
- Linux Docker image build: passed;
- baked models with container networking disabled: passed;
- container `/health`: passed;
- full temporary chat/query/delete cycle: passed with a non-empty answer and citations;
- container memory: approximately 257 MiB idle and 380 MiB after both models and a full RAG query;
- test image size: approximately 2.17 GB because unrelated notebook/data-analysis dependencies remain in the production dependency group, as cleanup was explicitly out of scope.

Known non-ONNX deployment note: the current Groq configuration logged structured-tool/model availability errors during testing, although the agent fallback still returned successful answers. Confirm that `GROQ_CHAT_MODEL` and `GROQ_FAST_MODEL` name models currently available to the Railway Groq account before deployment.

## Decisions specific to this repository

### Preserve the current embedding behavior without the Sentence Transformers library

Use FastEmbed's supported model:

```text
sentence-transformers/all-MiniLM-L6-v2
```

> **Important distinction:** `sentence-transformers/all-MiniLM-L6-v2` is the registered model identifier used by FastEmbed. It is not the `sentence-transformers` Python package. The migrated application will instantiate this model with `fastembed.TextEmbedding` and execute its ONNX files with ONNX Runtime. Neither the `sentence-transformers` library nor PyTorch will be installed or imported. The identifier retains the model publisher namespace because that is the exact name FastEmbed expects.

This is preferable to changing to BGE because the current application:

- embeds ingested transcript chunks with `all-MiniLM-L6-v2`;
- embeds questions with the same model;
- stores 384-dimensional vectors in PostgreSQL through `Vector(384)`;
- already has persisted vectors that should remain usable.

FastEmbed lists this model as a 384-dimensional, approximately 90 MB model. Keeping the same model and dimension avoids a pgvector schema migration. Before relying on existing vectors, numerical compatibility will still be verified against the current Sentence Transformers output.

### Preserve the current reranker family

Replace:

```text
cross-encoder/ms-marco-MiniLM-L-6-v2
```

with FastEmbed's supported ONNX conversion:

```text
Xenova/ms-marco-MiniLM-L-6-v2
```

The FastEmbed model is approximately 80 MB. The surrounding behavior will remain unchanged: rerank only the fused shortlist, add `rerank_score` to each chunk, sort descending, and return the first `top_k` chunks.

### One instance of each model

The current code can load `all-MiniLM-L6-v2` twice:

- once in `app/ingestion/embeddings.py`;
- once in `app/rag/embeddings.py`.

It also loads the cross-encoder in `app/rag/reranker.py`. The migration will introduce one cached embedding-model instance and one cached reranker instance shared by ingestion and retrieval. This is an implementation/runtime optimization; it does not change the retrieval algorithm.

## In scope

1. Replace the two Sentence Transformers model integrations with FastEmbed.
2. Remove `torch` and `sentence-transformers` from production dependencies.
3. Add and lock a tested FastEmbed version.
4. Cache the two ONNX models in the Railway Docker image at build time.
5. Run one Uvicorn worker.
6. Add Docker/Railway deployment files required for the backend.
7. Verify output compatibility, end-to-end behavior, startup, and memory use.
8. Document Railway and Vercel environment configuration needed to connect the deployed frontend and backend.

## Explicitly out of scope

The following suggestions from the reference guide will not be implemented as part of this migration unless separately approved:

- switching the embedding model to `BAAI/bge-small-en-v1.5`;
- changing `Vector(384)` or running a vector-dimension migration;
- deleting or automatically regenerating existing transcript embeddings;
- changing chunk size, overlap, dense retrieval, full-text retrieval, RRF, candidate counts, or `top_k`;
- changing prompts, LangGraph nodes, citations, chat memory, or Groq model selection;
- changing the YouTube metadata/transcript ingestion order;
- changing SQLAlchemy or LangGraph pool sizes before memory measurements justify it;
- removing unrelated dependencies solely as general cleanup;
- changing frontend features, authentication, or UI behavior;
- using multiple web workers.

## Planned file changes

Only after approval, the following files will be changed or added.

### 1. `backend/pyproject.toml`

- Remove `torch`.
- Remove `sentence-transformers`.
- Add a bounded FastEmbed version that is confirmed by a local API smoke test.
- Leave unrelated dependencies unchanged during this migration.

Initial intended constraint:

```toml
"fastembed>=0.8.1,<0.9"
```

If the lock resolver selects a different current compatible release, the selected version and reason will be recorded before proceeding.

### 2. `backend/uv.lock`

Regenerate from `backend/` after changing `pyproject.toml`:

```powershell
cd backend
uv lock
uv sync --frozen
```

The completed lockfile must contain FastEmbed/ONNX Runtime and must not contain PyTorch or Sentence Transformers, including as transitive dependencies.

### 3. New shared model module

Add a small module such as:

```text
backend/app/core/ml_models.py
```

It will own these constants and cached factories:

```python
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
RERANKER_MODEL_NAME = "Xenova/ms-marco-MiniLM-L-6-v2"
```

The factories will use `functools.lru_cache(maxsize=1)` and FastEmbed's CPU runtime with a conservative thread count. Parallel worker processes will not be enabled because FastEmbed workers can create additional model copies.

Conceptual interface:

```python
get_embedding_model() -> TextEmbedding
get_reranker_model() -> TextCrossEncoder
```

The exact constructor arguments will be validated against the locked FastEmbed release rather than copied blindly from the reference document.

### 4. `backend/app/ingestion/embeddings.py`

Keep its public interface unchanged:

```python
embed_texts(texts: list[str]) -> list[list[float]]
```

Implementation changes only:

- obtain the shared FastEmbed `TextEmbedding` instance;
- call `embed()` over transcript text batches;
- consume FastEmbed's generator;
- convert each NumPy vector to a plain Python list for pgvector;
- use a conservative batch size initially and measure peak memory during ingestion.

No chunking or pipeline behavior will change.

### 5. `backend/app/rag/embeddings.py`

Keep its public interface unchanged:

```python
generate_question_embedding(question: str) -> list[float]
```

Use the same shared model as ingestion. To preserve current semantics, generate the question vector through the normal `embed()` path rather than introducing a BGE-style query instruction or a different model-specific query transformation.

### 6. `backend/app/rag/reranker.py`

Keep this public interface and return shape unchanged:

```python
rerank_chunks(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]
```

Implementation changes only:

- extract `chunk["content"]` values in their existing order;
- call `TextCrossEncoder.rerank()`;
- consume scores into a list;
- attach each score as `chunk["rerank_score"]`;
- sort descending and return `top_k` as the current code does.

### 7. `backend/app/ingestion/pipeline.py`

Do not change ingestion flow. Only centralize the embedding model label if needed. The stored vector dimension remains 384.

### 8. `backend/app/main.py`

Optionally pre-load the two cached models in the existing FastAPI lifespan after their files have been baked into the image. This makes Railway health readiness represent a fully initialized service and prevents the first professor/demo request from paying model-load latency.

Preloading will be retained only if measured startup memory remains safely below the Railway limit. Otherwise, the embedding model will be loaded at startup and the reranker lazily on the first query. Either choice preserves application logic.

The existing LangGraph checkpointer lifecycle will remain intact.

### 9. New `backend/Dockerfile`

The Docker image will:

1. use the repository's Python 3.12 requirement;
2. install dependencies from `pyproject.toml` and `uv.lock` with `uv sync --frozen --no-dev`;
3. define a persistent FastEmbed cache directory inside the image;
4. download both selected ONNX models during the image build;
5. copy the application source;
6. run exactly one Uvicorn worker;
7. bind to `0.0.0.0` and Railway's injected `PORT`.

The runtime command must use a shell when expanding `$PORT`, for example:

```dockerfile
CMD ["sh", "-c", "exec uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
```

The final Dockerfile will not hard-code port 8000 as the only runtime port.

### 10. New `backend/.dockerignore`

Exclude at least:

```text
.env
.venv/
__pycache__/
*.pyc
.pytest_cache/
migrations/__pycache__/
```

Tests may also be excluded from the runtime image after they have run in verification.

### 11. Optional `backend/railway.toml`

Prefer Railway dashboard settings unless configuration-as-code is wanted. If added, it will contain only deployment/build/health settings and no secrets.

## Compatibility gate before removing the old runtime

The migration will be done in a temporary transition state in which both implementations can be compared locally. PyTorch/Sentence Transformers will be removed only after these checks pass.

### Dense-vector checks

For representative transcript chunks and questions:

1. generate vectors with the existing Sentence Transformer;
2. generate vectors with FastEmbed `all-MiniLM-L6-v2`;
3. confirm both outputs contain exactly 384 finite floats;
4. confirm vectors are normalized as expected by cosine search;
5. compare corresponding vectors and nearest-neighbor ordering;
6. test a FastEmbed question vector against existing Supabase vectors.

Passing condition: existing stored vectors remain useful and retrieval ordering is materially equivalent. Exact bit-for-bit equality is not required from different inference runtimes, but a meaningful ranking change is a failure requiring review.

If this gate fails, no automatic database rewrite will occur. The options—adjust preprocessing or explicitly re-embed stored chunks—will be presented for approval.

### Reranker checks

For fixed query/chunk fixtures:

1. compare the old and ONNX score counts;
2. confirm all scores are finite;
3. compare descending chunk order;
4. confirm `rerank_score` remains a Python float;
5. confirm `top_k` and empty-input behavior are unchanged.

Minor floating-point score differences are acceptable; unexpected ranking changes are not.

## Verification sequence

### Static verification

```powershell
rg -n "from sentence_transformers|import sentence_transformers|from torch|import torch" backend/app backend/pyproject.toml
uv tree | Select-String -Pattern "^(torch|sentence-transformers)(\s|$)"
```

Both commands must return no old runtime imports or installed packages. The FastEmbed model identifier `sentence-transformers/all-MiniLM-L6-v2` is expected to remain in application configuration; it names an ONNX model and does not mean the Sentence Transformers package is installed.

### Unit-level verification

- Empty embedding input returns `[]`.
- One and multiple transcript texts produce 384-dimensional vectors.
- Question embedding produces one 384-dimensional list.
- Reranking preserves dictionary objects and attaches float scores.
- Empty reranker input returns `[]`.
- Reranker returns no more than `top_k` chunks.

### Database compatibility verification

- Confirm the live pgvector column is 384-dimensional.
- Query existing vectors with a FastEmbed-generated question vector.
- Ingest one new test video and confirm stored vectors are 384-dimensional.
- Ensure old and new videos can both be queried.
- Do not delete existing rows during testing.

### End-to-end verification

Run locally from `backend/`:

```powershell
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verify:

1. `/health` returns 200;
2. existing chats and messages still load;
3. a previously ingested video answers questions;
4. a new video ingests successfully;
5. hybrid dense + PostgreSQL full-text retrieval still runs;
6. RRF still feeds ten candidates to the reranker;
7. the reranker still returns the configured top five;
8. citations and timestamps remain valid;
9. chat memory/checkpoint fallback behavior remains operational.

### Container verification

Build the exact Railway image locally, then run it with a safe local env file:

```powershell
docker build -t citetube-backend ./backend
docker run --rm --env-file backend/.env -e PORT=8000 -p 8000:8000 citetube-backend
```

Verify that runtime startup uses the baked model cache and does not download models.

### Memory verification

Measure the container rather than estimating from model file sizes:

- idle after both models are loaded;
- during a question/reranking request;
- during transcript embedding for a realistic video;
- during LangGraph/Groq calls and database activity.

Target:

- peak comfortably below 512 MB;
- preferred peak at or below approximately 400 MB to leave operational headroom;
- one Uvicorn worker only;
- no FastEmbed multiprocessing/parallel workers.

If peak memory is too high, adjust in this order without changing RAG logic:

1. reduce embedding batch size;
2. reduce ONNX thread count;
3. lazy-load the reranker instead of preloading it;
4. measure and reduce connection-pool sizes only if database pools are a material contributor;
5. stop and request approval before changing models or retrieval behavior.

## Railway deployment steps

After local and container verification:

1. Commit the approved backend changes, Dockerfile, `.dockerignore`, and updated lockfile.
2. Create a Railway service from the GitHub repository.
3. Set the service root directory to `/backend`.
4. Let Railway build `backend/Dockerfile`.
5. Configure public networking.
6. Set healthcheck path to `/health`.
7. Add backend environment variables in Railway, never in Git:

```text
DATABASE_URL
GROQ_API_KEY
GROQ_CHAT_MODEL
GROQ_FAST_MODEL                  # if used
GROQ_REASONING_EFFORT            # if used
ALLOWED_ORIGINS                  # after CORS is made environment-driven
```

8. Do not upload `backend/.env` or any Supabase service-role key unless the backend actually needs it.
9. Deploy and inspect build logs for successful ONNX model caching.
10. Inspect runtime logs for model loads, database connectivity, and healthcheck success.
11. Exercise one existing-video query and one ingestion/query flow.
12. Observe Railway memory during both operations before sharing the application.

Railway requires the server to bind to `0.0.0.0` and its `PORT` variable. The service root should be `/backend` for this monorepo layout.

## Vercel frontend connection

After Railway assigns the backend public domain:

1. set the Vercel frontend variable:

```text
VITE_API_BASE_URL=https://<railway-domain>/api/v1
```

2. allow the exact Vercel production origin in FastAPI CORS;
3. redeploy both services;
4. test authentication, chat history, ingestion, questions, and citations from the Vercel URL.

The current backend hard-codes localhost CORS origins. Making CORS environment-driven is required for deployment but is separate from the PyTorch-to-ONNX migration and must not alter RAG behavior.

## Rollback plan

Before deployment, keep the last working commit and Railway deployment available.

If ONNX compatibility, memory, or production behavior fails:

1. roll Railway back to the previous deployment;
2. do not modify or delete stored vectors;
3. preserve logs and measured memory data;
4. identify whether the failure is dependency installation, model cache, preprocessing compatibility, or RAM;
5. revise the plan and request approval before choosing a different model or re-embedding data.

## Completion criteria

The migration is complete only when all of the following are true:

- `torch` and `sentence-transformers` are absent from production dependencies and the resolved lockfile;
- FastEmbed supplies both dense embeddings and reranker scores;
- embedding output remains 384-dimensional;
- existing vectors pass the compatibility gate;
- no pgvector schema or application response contract changes are required;
- both ONNX models are present in the built image and no runtime download occurs;
- the container runs one Uvicorn worker on Railway's `PORT`;
- peak measured memory stays safely under 512 MB;
- existing-video retrieval, new-video ingestion, reranking, answers, citations, and chat history pass end-to-end tests;
- Vercel can call Railway through the configured API URL and allowed origin;
- no secrets or local environment files are committed.

## References

- [FastEmbed overview](https://qdrant.tech/documentation/fastembed/)
- [FastEmbed supported embedding models](https://qdrant.github.io/fastembed/examples/Supported_Models/)
- [FastEmbed cross-encoder reranking](https://qdrant.tech/documentation/fastembed/fastembed-rerankers/)
- [FastEmbed throughput and worker behavior](https://qdrant.tech/documentation/fastembed/fastembed-optimize/)
- [Railway monorepo root directories](https://docs.railway.com/deployments/monorepo)
- [Railway FastAPI start command](https://docs.railway.com/deployments/troubleshooting/no-start-command-could-be-found)
- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks)
