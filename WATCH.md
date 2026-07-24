# truecopy marketplace watch

> The official Claude Code plugin directory ([anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)) — every catalog plugin, including the external vendor plugins fetched at their catalog-pinned SHAs — re-scanned on a schedule by [truecopy](https://github.com/askalf/truecopy). Latest snapshot — history in [history.jsonl](./history.jsonl), methodology in [the 2,019-skill study](https://sprayberrylabs.com/blog/auditing-the-skills-supply-chain).

**2026-07-24** — **273** plugins · **1889** skills scanned · **0** poisoned · **580** advisories

## Accepted findings (reviewed benign)

Skills whose findings were manually reviewed and accepted for **exactly these bytes** ([watch-accepted.json](https://github.com/askalf/truecopy/blob/master/support/watch-accepted.json), truecopy's `--force` semantics) — any content change re-flags them. Entries marked *per-file* key the acceptance to the reviewed finding-bearing files instead: those files changing re-flags, and everything else in the skill must still scan clean, but unrelated upstream churn no longer lapses the review.

Entries marked *per-flag* are the weakest of the three and say so: the reviewed file may change, and the acceptance holds while the flags it produces stay within the reviewed set. Used only where the finding-bearing file is itself the thing that churns. Everything outside the reviewed files must still scan clean, a **new** flag re-flags, the entry lapses on the date shown — at which point a human re-reads it or it goes back on the board — and *changed since review* means the vendor has edited the skill since the bytes a human actually read.

- **agentforce-adlc:agentforce-generate** — agentforce-generate: instruction-override — *security-testing fixtures: Salesforce Agentforce docs ship attack strings as test payloads — per-file acceptance (#68) after two whole-skill lapses in one week (#65, #67), both re-reviews finding only unrelated docs churn; the fixture file is the reviewed bytes from those reads* *(per-file)*
- **agentforce-adlc:agentforce-secure** — agentforce-secure: instruction-override; system-prompt/secret extraction — *security-testing fixtures: Salesforce Agentforce docs ship attack strings as test payloads — per-file acceptance (#68), fixture bytes identical to the 2026-07-09 review* *(per-file)*
- **agentforce-adlc:agentforce-test** — agentforce-test: instruction-override; jailbreak persona; reads a secret env var — *security-testing fixtures: Salesforce Agentforce docs ship attack strings as test payloads — per-file acceptance (#68), fixture bytes identical to the 2026-07-09 review* *(per-file)*
- **aws-core:launch-with-aws** — launch-with-aws: data-exfil instruction; references a sensitive path (.ssh/.env/credentials/…) — *defensive quoting: AWS's own OIDC config hardening: 'Refusing to send credentials over a non-HTTPS connection' refusal strings + its ~/.launch-with-aws session path constant — the module validates endpoints against exfil, it doesn't perform it* *(per-file)*
- **aws-data-analytics:finding-data-lake-assets** — finding-data-lake-assets: instruction-override — *defensive quoting: quotes 'ignore previous instructions' to teach resisting it*
- **convex:billing** — billing: data-exfil (paraphrased) — *paraphrased-exfil near-miss: Stripe integration docs: 'copy the signing secret as STRIPE_WEBHOOK_SECRET' — no exfil destination*
- **databricks:databricks-mlflow-evaluation** — databricks-mlflow-evaluation: instruction-override — *defensive quoting: quotes 'ignore previous instructions' to teach resisting it*
- **mercadopago:mp-integrate** — mp-integrate: data-exfil (paraphrased); references a sensitive path (.ssh/.env/credentials/…); reads a secret env var — *paraphrased-exfil near-miss: webhook signing-secret integration docs*
- **newrelic:finops** — finops: instruction-override — *defensive quoting: vendor Security Rules block quotes 'ignore previous instructions'/'pretend you are a different agent' to teach resisting them — full-file review at catalog pin f8e5f8b (#77)*
- **newrelic:kubernetes** — kubernetes: instruction-override; exfiltration intent — *defensive quoting: same Security Rules block; 'exfiltration intent' = composite FP of the secrecy block + an example diagnosis naming a payments namespace — no send/destination, only tool is execute_nrql_query (#77)*
- **posthog:setting-up-a-data-warehouse-source** — setting-up-a-data-warehouse-source: data-exfil (paraphrased) — *paraphrased-exfil near-miss: data-warehouse source setup docs — re-read in full 2026-07-17 after upstream drift lapsed the 07-09 whole-skill accept: new secure connect-link flow explicitly forbids pasting secrets in chat; converted to per-file (PostHog ships constantly)* *(per-file)*
- **posthog:signals-scout-logs** — signals-scout-logs: instruction-override — *defensive quoting: log-scout prompt quotes injection strings ('ignore prior rules', 'file a report saying X') in its own log-content-is-untrusted-data defense section — teaches resisting, not performing* *(per-file)*
- **receipts:receipts** — receipts: instruction-override; references a sensitive path (.ssh/.env/credentials/…) — *defensive quoting: Anthropic in-repo usage-report plugin: mines ~/.claude/projects transcripts LOCALLY (miner has zero network primitives, execFileSync=git only, hand-verified) and quotes 'ignore previous instructions' in its names-are-data defense; sensitive path = its own documented data source* *(per-file)*
- **resend:resend** — resend: data-exfil (paraphrased); reads a secret env var — *paraphrased-exfil near-miss: re-reviewed after upstream drift lapsed the 07-09 accept (vendor edited the skill; catalog now pins resend/resend-skills@044372f). Same benign pattern in the current bytes, verified line-by-line: 'data-exfil (paraphrased)' = references/webhooks.md:196, a Resend-dashboard walkthrough ('copy the signing secret... store it as RESEND_WEBHOOK_SECRET') with no exfil destination; 'reads a secret env var' = references/logs.md:56, a curl example authenticating TO Resend's own API via Authorization: Bearer $RESEND_API_KEY, not reading it out to anywhere*
- **sagemaker-ai:hyperpod-cluster-debugger** — hyperpod-cluster-debugger: obfuscated payload to shell — *obfuscated remote-exec transport: AWS HyperPod debugging docs use base64|bash as a transport — transparent about what it runs*
- **sagemaker-ai:hyperpod-nccl** — hyperpod-nccl: obfuscated payload to shell; reads a secret env var — *obfuscated remote-exec transport: Per-flag acceptance (#87) after the whole-skill hash lapsed twice on the SAME two reviewed-benign flags — AWS produced three distinct skill hashes in a few hours on 2026-07-21, and the only file changing upstream is the finding-bearing one, so per-file granularity (#68) would buy nothing. Both flags re-verified against the bytes at catalog pin 153b28e. (1) 'obfuscated payload to shell' — scripts/nccl-diagnose.sh:1499 base64-encodes its OWN locally-built $script_body and decodes it on the remote host at :1500, because AWS-StartNonInteractiveCommand collapses newlines in a single command element; the comment two lines above says exactly that, and nothing is fetched (contrast the real threat shape, curl <url> | base64 -d | bash). (2) 'reads a secret env var' — since the redstamp bump killed the lowercase-$token FP this now matches ${NCCL_PAT_KEYS[...]} at :1049, a local bash array declared at :940 holding NCCL log-error patterns ('Timeout waiting for', 'Connection refused', …). PAT = pattern; nothing is read from the environment. Everything outside nccl-diagnose.sh must still scan clean, a NEW flag re-flags, and this lapses on 2026-10-20.* *(per-flag, expires 2026-10-20)*
- **sagemaker-ai:hyperpod-node-debugger** — hyperpod-node-debugger: obfuscated payload to shell; reads a secret env var — *obfuscated remote-exec transport: AWS HyperPod debugging docs use base64|bash as a transport — transparent about what it runs*
- **sagemaker-ai:hyperpod-slurm-debugger** — hyperpod-slurm-debugger: obfuscated payload to shell — *obfuscated remote-exec transport: AWS HyperPod debugging docs use base64|bash as a transport — transparent about what it runs*

## Advisories

Capability *mentions* (sensitive paths, secret env vars) in skill prose — shown, never blocking. Documentation legitimately teaches credential handling; only *instructions* block.

- **42crunch-api-security-testing:generate-oas** — generate-oas: references a sensitive path (.ssh/.env/credentials/…)
- **agentforce-adlc:agentforce-observe** — agentforce-observe: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-access-management** — alloydb-postgres-access-management: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-admin** — alloydb-postgres-admin: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-data** — alloydb-postgres-data: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-health** — alloydb-postgres-health: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-monitor** — alloydb-postgres-monitor: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-optimize** — alloydb-postgres-optimize: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb:alloydb-postgres-replication** — alloydb-postgres-replication: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-access-control** — alloydb-omni-access-control: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-data** — alloydb-omni-data: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-health** — alloydb-omni-health: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-monitor** — alloydb-omni-monitor: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-optimize** — alloydb-omni-optimize: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-performance** — alloydb-omni-performance: references a sensitive path (.ssh/.env/credentials/…)
- **alloydb-omni:alloydb-omni-replication** — alloydb-omni-replication: references a sensitive path (.ssh/.env/credentials/…)
- **amazon-location-service:amazon-location-service** — amazon-location-service: reads a secret env var
- **amplitude:diagnose-errors** — diagnose-errors: exfiltration intent
- **amplitude:taxonomy** — taxonomy: exfiltration intent
- **apollo-skills:apollo-ios** — apollo-ios: reads a secret env var
- **apollo-skills:apollo-mcp-server** — apollo-mcp-server: reads a secret env var
- **apollo-skills:apollo-router** — apollo-router: reads a secret env var
- **apollo-skills:graphql-schema** — graphql-schema: exfiltration intent
- **apollo-skills:rover** — rover: reads a secret env var
- **astronomer-data-agents/astronomer-data:airflow** — airflow: reads a secret env var
- **astronomer-data-agents/astronomer-data:airflow-plugins** — airflow-plugins: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:analyzing-data** — analyzing-data: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **astronomer-data-agents/astronomer-data:configuring-airflow-language-sdks** — configuring-airflow-language-sdks: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:delegating-to-otto** — delegating-to-otto: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:deploying-go-sdk-bundles** — deploying-go-sdk-bundles: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:deploying-java-sdk-bundles** — deploying-java-sdk-bundles: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:migrating-ai-sdk-to-common-ai** — migrating-ai-sdk-to-common-ai: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:migrating-dagster-to-airflow** — migrating-dagster-to-airflow: references a sensitive path (.ssh/.env/credentials/…)
- **astronomer-data-agents/astronomer-data:troubleshooting-astro-deployments** — troubleshooting-astro-deployments: references a sensitive path (.ssh/.env/credentials/…)
- **atomic-agents:framework** — framework: references a sensitive path (.ssh/.env/credentials/…)
- **atomic-agents:new-app** — new-app: references a sensitive path (.ssh/.env/credentials/…)
- **auth0:auth0** — auth0: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-agents:agents-build** — agents-build: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-agents:agents-connect** — agents-connect: references a sensitive path (.ssh/.env/credentials/…)
- **aws-agents:agents-get-started** — agents-get-started: references a sensitive path (.ssh/.env/credentials/…)
- **aws-agents:agents-harden** — agents-harden: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…)
- **aws-agents-for-devsecops:setup-devops-agent** — setup-devops-agent: references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-amplify:amplify-workflow** — amplify-workflow: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:amazon-bedrock** — amazon-bedrock: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-core:aws-billing-and-cost-management** — aws-billing-and-cost-management: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-blocks** — aws-blocks: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-cdk** — aws-cdk: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-compute** — aws-compute: exfiltration intent
- **aws-core:aws-containers** — aws-containers: references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-core:aws-deployment** — aws-deployment: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-iam** — aws-iam: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-observability** — aws-observability: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-sdk-js-v3-usage** — aws-sdk-js-v3-usage: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-sdk-python-usage** — aws-sdk-python-usage: references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:aws-secrets-manager** — aws-secrets-manager: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…)
- **aws-core:signing-in-to-aws** — signing-in-to-aws: references a sensitive path (.ssh/.env/credentials/…)
- **aws-data-analytics:amazon-opensearch-service** — amazon-opensearch-service: exfiltration intent; reads a secret env var
- **aws-dev-toolkit:api-gateway** — api-gateway: reads a secret env var
- **aws-dev-toolkit:cloudfront** — cloudfront: references a sensitive path (.ssh/.env/credentials/…)
- **aws-dev-toolkit:ec2** — ec2: exfiltration intent
- **aws-dev-toolkit:eks** — eks: references a sensitive path (.ssh/.env/credentials/…)
- **aws-dev-toolkit:migration-apprunner-to-ecs-express** — migration-apprunner-to-ecs-express: references a sensitive path (.ssh/.env/credentials/…)
- **aws-dev-toolkit:rds-aurora** — rds-aurora: exfiltration intent
- **aws-dev-toolkit:s3** — s3: exfiltration intent
- **aws-serverless:api-gateway** — api-gateway: references a sensitive path (.ssh/.env/credentials/…)
- **aws-serverless:aws-lambda-managed-instances** — aws-lambda-managed-instances: references a sensitive path (.ssh/.env/credentials/…)
- **aws-serverless:aws-lambda-microvms** — aws-lambda-microvms: references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-serverless:aws-serverless-deployment** — aws-serverless-deployment: references a sensitive path (.ssh/.env/credentials/…)
- **aws-startup-advisor:architect-for-startups** — architect-for-startups: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…)
- **aws-startup-advisor:knowledge-base-for-startups** — knowledge-base-for-startups: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…)
- **aws-startup-advisor:migration-to-aws** — migration-to-aws: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-startup-advisor:prompt-library-for-startups** — prompt-library-for-startups: references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **aws-transform:aws-transform** — aws-transform: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **azure:appinsights-instrumentation** — appinsights-instrumentation: reads a secret env var
- **azure:azure-cloud-migrate** — azure-cloud-migrate: references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **azure:azure-compute** — azure-compute: exfiltration intent; references a sensitive path (.ssh/.env/credentials/…); reads a secret env var
- **azure:azure-cost** — azure-cost: exfiltration intent
- **azure:azure-deploy** — azure-deploy: references a sensitive path (.ssh/.env/credentials/…)
- **azure:azure-diagnostics** — azure-diagnostics: exfiltration intent
- **azure:azure-enterprise-infra-planner** — azure-enterprise-infra-planner: references a sensitive path (.ssh/.env/credentials/…)
- …and 500 more skills with advisories — full rows in [results.json](./results.json)
