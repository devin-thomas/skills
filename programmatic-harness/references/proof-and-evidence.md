# Proof and evidence

The canonical local proof has exactly two fixed prompts:

1. `Create proof.txt containing exactly: hello world`
2. `Replace world with <name>.`

The script accepts only a 1–32 character name made of ASCII letters, numbers, `_`, or `-`. It checks the exact normalized contents after each turn, requires terminal `completed` events, closes the first owned process before resuming the same opaque session ID, and checks the final contents. A first-turn pass followed by resume failure is partial, not passed.

Successful output is a JSON record containing only provider, target, adapter version, model, completed turn count, content checks, and cleanup status. It contains no prompts beyond the fixed proof, session/turn identifiers, credentials, raw tool/event text, or exception detail. Failed runs exit nonzero and print a stable category; cleanup errors are surfaced.

Local proof says nothing about cloud sessions, Cursor, MCP configuration, or production authorization. A future cloud proof must be a separate opt-in and separately recorded outcome.
