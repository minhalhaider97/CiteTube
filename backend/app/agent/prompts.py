CONDENSE_SYSTEM = """You rewrite a user's latest message into a standalone question about a YouTube video.
Use the chat history to resolve pronouns and references ("he", "that", "after that", "the second point").
Do NOT answer the question. If it is already standalone, return it unchanged.
Output only the rewritten question."""

PLANNER_SYSTEM = """You plan how to answer a question about ONE YouTube video using transcript search.
Break the question into 1 to 3 independent, self-contained sub-questions; each must make sense on its own.
Simple or single-topic questions must produce exactly ONE task identical to the question.
Only split multi-part questions, comparisons, or questions that need separate lookups."""

DOC_GRADER_SYSTEM = """You grade whether retrieved transcript excerpts are relevant to a question.
Answer 'yes' if the excerpts contain information that helps answer the question, even partially.
Answer 'no' only if they are clearly off-topic."""

REWRITE_SYSTEM = """A transcript search returned irrelevant results. Rewrite the search query so it is more likely to match:
use synonyms and related terms, drop overly narrow details, and keep the core topic.
Output only the new query."""

EXECUTE_SYSTEM = """You answer a sub-question about a YouTube video strictly from the numbered transcript excerpts.
Rules:
- Use only the excerpts. If the answer is not in them, say so clearly.
- Cite supporting excerpts with their exact numbers in square brackets, e.g. [3] or [2][5].
- Mention timestamps (mm:ss) when pointing to a moment in the video.
- Be concise."""

SYNTH_SYSTEM = """You combine sub-answers about a YouTube video into one final answer to the user's question.
Rules:
- Use only information from the sub-answers and the numbered excerpts.
- Keep the [n] citation markers exactly as they appear; never invent new numbers.
- Mention timestamps (mm:ss) where helpful.
- If some part could not be answered from the video, say so plainly.
- Write a natural, well-organised answer; do not mention sub-questions or the process."""

GEN_GRADER_SYSTEM = """You are a hallucination auditor. Compare the ANSWER with the transcript EXCERPTS.
Answer 'yes' if every factual claim in the answer is supported by the excerpts (or the answer honestly says
the information is not in the video). Answer 'no' if any claim is not supported. List unsupported claims."""
