# ID8 Decision Readiness Engine POC

A Next.js proof of concept showing how ID8 turns incoming events into decision-ready situations using durable FeltDB state.

## Stack

- Next.js App Router
- `@feltdb/core` `0.11.1`
- FeltDB durable Node file runtime on the server
- FeltDB browser client pointed at the local Next.js API

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## What the POC demonstrates

- durable lifecycle entities for attention, context, intent, plan, work, evidence, evaluation, decision, action, and outcome
- generic evidence-based readiness evaluation across multiple business domains
- a decision inbox that shows only decision-ready situations by default
- durable actions, outcomes, and follow-up attentions after a human decision
