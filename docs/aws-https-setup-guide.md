# AWS HTTPS Setup Guide - pickatstore.io

This document tracks the progress and configuration of the HTTPS setup for the `pickatstore.io` API and services.

## 1. SSL Certificate (ACM)
**Status:** Pending Validation (Wait until status is "Issued")

### CNAME Validation Records
| Domain | CNAME Name | CNAME Value |
| :--- | :--- | :--- |
| `www.pickatstore.io` | `_139407f1506831b91ecd23d0bb714536.www.pickatstore.io.` | `_fa2849c177958944358eab86937778ff.jkddzztszm.acm-validations.aws.` |

> [!IMPORTANT]
> **CNAME Host Note:** In your registrar (e.g., Domain Control Panel), ensure you only enter `_139407f1506831b91ecd23d0bb714536.www` if the domain is automatically appended.

## 2. Security Group Configuration
**Status:** Requires Verification (Inbound Rules)

Ensure the Security Group (used by your EC2 instance or Load Balancer) allows incoming traffic on **Port 443 (HTTPS)**.

### Inbound Rules to Add:
| Type | Port | Source | Description |
| :--- | :--- | :--- | :--- |
| HTTPS | 443 | `0.0.0.0/0` | Allow all IPv4 HTTPS traffic |
| HTTPS | 443 | `::/0` | Allow all IPv6 HTTPS traffic |

## 3. Next Steps (After "Issued" Status)
Once ACM validation is successful:
1. Go to **EC2 > Load Balancers**.
2. Select your Load Balancer (or create one if not yet done).
3. Add a **Listener** for HTTPS:
   - **Protocol/Port:** `HTTPS:443`
   - **Default Action:** Forward to your Target Group.
   - **Default SSL/TLS certificate:** Select the `pickatstore.io` certificate from ACM.
4. Update the **CNAME record** in your registrar for `api.pickatstore.io` to point to the Load Balancer's DNS name.
