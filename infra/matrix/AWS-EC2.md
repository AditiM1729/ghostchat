# Matrix on AWS EC2: low-cost GhostChat demo

Checked October 28, 2026. Recommendation for a small, invite-only pilot, not a capacity guarantee or a record of a running AWS deployment.

## Suggested starting configuration

| Item | Recommendation |
| --- | --- |
| Region | Mumbai (`ap-south-1`) for nearby Indian users |
| Instance | `t4g.small`: 2 vCPUs, 2 GiB RAM, ARM64 |
| Operating system | Official Ubuntu Server 24.04 LTS **ARM64**, standard non-Marketplace image |
| Disk | Start with 20 GiB encrypted gp3 at baseline performance; monitor free space/media growth |
| Services | Existing Docker Compose stack: Synapse, PostgreSQL and Caddy on the same instance |
| Network | One public IPv4, domain/subdomain with DNS to the host, HTTPS through Caddy |
| CPU credit mode | Standard for a strict compute-cost ceiling, accepting throttling after CPU credits run out |
| Access | Invite-only accounts and small groups initially; no calls/media-heavy public-room workload |

The configured Synapse `v1.163.0`, PostgreSQL `17-alpine` and Caddy `2-alpine` image manifests advertised Linux ARM64 when checked. This is an architecture check, not a successful EC2/container runtime test. Review upstream security updates and pin tested image digests before a public launch. Synapse state, database, media and TLS data must persist on disk and be backed up.

`t4g.micro` has only 1 GiB RAM and is a tight fit for the OS plus all three services. `t4g.small` is my initial budget recommendation. Move to `t4g.medium` (4 GiB) if measured memory pressure, synchronization or media workload requires it. Do not assume any fixed user capacity. If ARM-specific dependencies fail, assess an x86 instance rather than silently running emulation on a tiny server.

## Credit preservation and pricing

AWS currently documents a **t4g.small trial of 750 aggregate instance-hours per month through December 31, 2026**, including Mumbai. The allowance is shared across eligible regions and, for consolidated billing, the payer organization. Verify how it appears in your billing account and whether other instances already consume it. The offer covers infrastructure compute within the allowance, not every associated service or surplus CPU charge. Regular pricing applies after the offer expires or its monthly hours are exceeded.

- [AWS T4g page](https://aws.amazon.com/ec2/instance-types/t4/)
- [AWS EC2 FAQ: T4g trial terms](https://aws.amazon.com/ec2/faqs/)

One public IPv4 costs **$0.005/hour**, about **$3.65 for a 730-hour month**, before any account-specific offsets. Idle Elastic IPs are also billable. EBS provisioned storage, snapshots, data transfer, monitoring/logs and taxes can add charges. An illustrative **$6-$10/month pilot allowance during eligible free compute** is a planning estimate for IPv4, a modest disk and light usage, not an AWS quote or spending cap. After the trial, add the instance's current regional compute price. Validate the estimate in the AWS calculator and account billing console before launch.

- [Public IPv4 pricing](https://aws.amazon.com/vpc/pricing/)
- [EBS pricing](https://aws.amazon.com/ebs/pricing/)
- [AWS calculator](https://calculator.aws/)

Check your remaining credit's eligible services, expiry and usage in Billing. Credits are not a substitute for budgets: set small actual and forecast cost alerts, and monitor CPU credit balance, RAM, disk and media storage. Budget alerts do not automatically stop spending.

For this pilot, avoid a NAT Gateway, load balancer and separate RDS database unless a concrete requirement justifies their additional cost. Keep PostgreSQL on the instance with tested backups. Spot interruption is undesirable for the only stateful messaging server. Start On-Demand without a long-term commitment. Stopping EC2 interrupts messaging and does not eliminate EBS, retained IP or backup charges.

## Launch and connect

1. Select the region, official ARM64 Ubuntu image and instance above. Choose a key pair or properly configured management access, require IMDSv2 and enable encrypted EBS. Review the launch estimate.
2. Allow inbound TCP **80/443** publicly for Caddy. Permit SSH **22 only from your current IP** if using SSH. UDP 443 is optional for HTTP/3. Leave PostgreSQL 5432 and Synapse 8008 private. The existing proxy publishes federation discovery over HTTPS; do not expose the admin API.
3. Use a domain you control, such as `matrix.your-domain.com`. Keep the Matrix server name stable because it becomes part of user identities. A stable public address/DNS arrangement avoids losing access after a stop/start. An Elastic IP remains billable even when retained idle.
4. Install Docker Engine with Compose and Node.js 20+ using current official Ubuntu instructions. Copy the existing Matrix bundle or repository to the server. Do not copy development `.env` files or wallet keys.
5. Generate configuration once from the repository root, replacing both example domains with actual controlled origins:

   ```sh
   node infra/matrix/configure.mjs --server matrix.your-domain.com --app https://your-ghostchat-app.example --output /srv/ghostchat-matrix
   cd /srv/ghostchat-matrix
   bash deploy.sh
   ```

   Use a directory owned by your deployment user, or create `/srv/ghostchat-matrix` with appropriate ownership first. `configure.mjs` generates private secrets and refuses to overwrite existing configuration. Never commit or print its generated files.

6. Create two test accounts using the internal interactive registration command in [README.md](README.md). Google OIDC is optional and requires private provider configuration and the exact callback on the homeserver origin.
7. In GhostChat, enter the homeserver HTTPS URL in messaging settings, or set `VITE_MATRIX_HOMESERVER` for the frontend build. Wallet/BridgeKey login and Matrix login remain separate.
8. Run the readiness probe and manually verify two-account encrypted chat, invites, attachments, reconnect and recovery. Test a second homeserver before claiming federation works. The complete in-app key-backup/device-verification setup remains pending.
9. Back up database, Synapse media/signing key/private configuration and Caddy volumes securely. Test restore to an isolated host. Keep uploads/registration limited while measuring pilot load.

This guide does not provision AWS resources, change DNS or deploy the MST payment backend. Matrix hosting and the payment relay are separate deployment tasks. See the main [homeserver guide](README.md) for existing scripts and recovery boundaries, and [Synapse installation guidance](https://element-hq.github.io/synapse/latest/setup/installation.html) for server requirements.
