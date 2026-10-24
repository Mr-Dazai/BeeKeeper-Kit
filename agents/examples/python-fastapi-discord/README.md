# Example specialists: Python / FastAPI / Discord

These four agents are stack-specific examples, adapted from
[VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (MIT, see
`THIRD_PARTY_NOTICES.md`). They were trimmed to one project: a FastAPI service that posts to Discord and exposes an
MCP server.

| File | Covers |
| --- | --- |
| `fastapi-developer.md` | FastAPI, Pydantic v2, async SQLAlchemy, Alembic, scheduler, tests |
| `webhook-engineer.md` | Discord webhooks, interactions, Ed25519 verification, deferred replies |
| `mcp-developer.md` | An MCP server and its tools |
| `readme-generator.md` | Project README |

They are not copied by the setup scripts. Use them as models for your own specialists: copy one into
`<project>/.claude/agents/`, rewrite the stack and rules, and add it to the dispatch table in `CLAUDE.md`.
