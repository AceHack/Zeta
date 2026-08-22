# ΔU: 081M092W2E7087G0R000KDKHWS — agencysignature validator names the artifact it was actually handed

- **measure:** added --source pr-body|commit-messages; the parse-failure and missing-keys text is now derived from the declared artifact instead of a hardcoded COMMIT MESSAGES claim, and the CLI refuses to run without the declaration
- **ΔU > 0 because:** one validator over two opposite inputs emitted one message that could not be true for both, so its diagnosis carried zero information about which artifact was read; declaring the source makes the diagnosis discriminating
- **witnessed by:** validate-agencysignature-pr-body.test.ts describe 'the failure text names the artifact it was actually handed' — 6 of its 7 cases fail against the pre-fix validator (9 failures total in the file), including the pr-body path asserting it never says 'at the very bottom of the COMMIT MESSAGE' and never prescribes git interpret-trailers
- **lineage:** filed as a work item by the shadow after PR #11707 was closed and rebuilt (#11710) chasing the wrong artifact, and a second agent hit it on #11712 within the hour
