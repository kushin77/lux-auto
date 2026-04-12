# Architecture Decision Records (ADRs)

ADRs document architectural decisions made in this project. Every major decision must have an ADR.

## When to Create an ADR

Create an ADR when:

- **Adding a new service** (cache layer, job queue, microservice)
- **Changing authentication/authorization** (new OAuth provider, RBAC model)
- **Modifying database schema** (new table, significant index strategy, sharding)
- **Switching frameworks or libraries** (FastAPI version bump, database migration)
- **Changing deployment architecture** (new container orchestration, serverless)
- **Defining operational strategy** (SLOs, error budgets, alerting)
- **Major security decisions** (encryption at rest, network segmentation)

Do NOT create ADRs for:
- Bug fixes
- Adding a new endpoint (unless it's architecturally novel)
- Refactoring without behavioral change
- Configuration changes

## ADR Process

1. **Create** a new file: `docs/adr/ADR-000-title.md`
2. **Write** sections: Status, Context, Decision, Alternatives, Consequences, etc.
3. **Get feedback** in PR (architect/senior engineer review)
4. **Change status** to "Accepted" when approved
5. **Reference** in commit: `[ADR-000] Implement decision`
6. **Update** if decision changes (mark as "Deprecated", link to superceding ADR)

## ADR Template

```markdown
# ADR-XXX: [Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-YYY]

## Context

Why are we considering this decision? What's the problem?
- Business drivers?
- Technical constraints?
- Compliance requirements?

## Decision

What are we doing? Be specific and actionable.

## Alternatives Considered

### Option A: [Name]
- Pros: 
- Cons:
- Effort:
- Risk:

### Option B: [Name]
- Pros: 
- Cons:
- Effort:
- Risk:

## Consequences

### Positive
- What benefits does this decision enable?

### Negative
- What are the tradeoffs?
- What operational burden is introduced?

## Security Implications

- How does this affect authentication/authorization?
- How does this affect data protection?
- How does this affect audit trails?
- Are there new compliance concerns?

## Scaling Implications

- Does this introduce a bottleneck?
- How does this scale to 10x load?
- What are the hardware/infrastructure requirements?
- Are there connection pool limits?

## Operational Impact

- How do we deploy this?
- How do we monitor it?
- How do we alert on failures?
- How do we rollback if it fails?

## References

- Related ADRs: [ADR-XXX, ADR-YYY]
- External docs: [Link to spec, RFC, etc.]
- Issue: [#123]

## Date

YYYY-MM-DD
```

## ADR Index

Currently documented decisions:

- **(Create ADRs as major decisions are made)**

## Deprecation Process

When an ADR is deprecated:

1. Create a new ADR with decision that supersedes it
2. Mark old ADR status: `Superseded by ADR-YYY`
3. Link to new ADR: `See ADR-YYY for current decision`
4. Do NOT delete (history matters)

## Review Checklist for ADR PRs

- [ ] Problem statement is clear (context)
- [ ] Decision is specific and actionable
- [ ] Multiple alternatives considered
- [ ] Tradeoffs are honest (not just positive)
- [ ] Security implications addressed
- [ ] Scaling implications addressed
- [ ] Operational burden understood
- [ ] Rollback strategy defined
- [ ] No orphaned ADRs (deprecated ones linked)

## Questions?

- Ask for ADR clarification in PR
- Propose alternatives before ADR is accepted
- Once accepted, implement against it (don't diverge)
