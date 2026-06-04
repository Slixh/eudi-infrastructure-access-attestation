# Infrastructure Access Attestation — Rulebook v1.0.0

## 1. Credential Purpose

The Infrastructure Access Attestation (IAA) grants its holder the right to access a specific physical resource (door, gate, or similar access-controlled infrastructure). It is issued after a prior authorization grant has been established by an administrator, and the holder has proven their identity via a PID presentation.

Eligible recipients: any natural person who has been granted access by an authorized administrator.

## 2. Applicable Regulations

- eIDAS 2.0 (Regulation EU 2024/1183)
- EUDI Wallet Architecture and Reference Framework (ARF)

## 3. Supported Formats

- `dc+sd-jwt` (SD-JWT VC) — online verification by access control systems

## 4. Semantic Structure

| Attribute | Type | Mandatory | Selective Disclosure | Description |
|---|---|---|---|---|
| `vct` | string | yes | no | Fixed: `urn:eudi:eaa:infrastructure:access:1` |
| `granted_resource` | string | yes | no | Identifier of the physical resource (e.g. `lock-001`) |
| `grant_id` | string | yes | no | Internal grant reference for audit |
| `valid_from` | string (date) | yes | no | ISO 8601 date from which access is valid |
| `valid_until` | string (date) | yes | no | ISO 8601 date until which access is valid |

All identity attributes (family_name, given_name) are intentionally excluded — the credential attests access rights only, not identity.

## 5. Trust & Governance Model

**Validity Period:** Maximum 365 days, aligned with the underlying grant.

**User Identification:** High-assurance PID presentation (OID4VP) is required before issuance. The holder's PID subject is recorded in the issuer's grant store.

**Attribute Verification:** The `granted_resource` value is set by an authorized administrator in the issuer's backend. No external authentic source is consulted.

**EAA Provider Requirements:** The issuer must operate a compliant OID4VCI endpoint, hold a valid access certificate issued by the ecosystem trust anchor, and maintain an audit log of all issuance and access events.

**Credential Signature:** ES256 or EdDSA electronic seal using a key certified by the ecosystem trust anchor.

**Revocation:** Token Status List (draft-ietf-oauth-status-list). Revocation is triggered by administrator action or grant expiry. Maximum revocation propagation latency: 24 hours.

**Anti-Tracking:** The `granted_resource` identifier is specific to the resource, not the holder. No stable global holder identifier is included in the credential.

## 6. Schema Reference

Credential Schema: see associated JSON Schema file.
