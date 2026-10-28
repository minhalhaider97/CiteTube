from typing import Literal

from pydantic import BaseModel, Field


class Plan(BaseModel):
    tasks: list[str] = Field(
        description="1 to 3 self-contained sub-questions, each answerable by one transcript search."
    )


class DocGrade(BaseModel):
    score: Literal["yes", "no"] = Field(
        description="'yes' if the excerpts contain information useful for the question."
    )


class GenerationGrade(BaseModel):
    score: Literal["yes", "no"] = Field(
        description="'yes' if every claim in the answer is supported by the excerpts."
    )
    unsupported_claims: str = Field(
        default="", description="Short list of claims not supported by the excerpts."
    )
