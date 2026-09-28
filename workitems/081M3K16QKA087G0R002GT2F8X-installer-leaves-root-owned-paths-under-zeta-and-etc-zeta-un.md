---
id: 081M3K16QKA087G0R002GT2F8X
type: bug
state: backlog
priority: P2
slug: installer-leaves-root-owned-paths-under-zeta-and-etc-zeta-un
title: "Installer leaves root-owned paths under ~zeta and /etc/zeta unreadable by git (chroot UID resolution fails; creds-to-k8s runs kubectl as root with HOME=/home/zeta)"
created: 2026-09-28T03:33:44.170Z
depends_on: []
composes_with: []
---

# Installer leaves root-owned paths under ~zeta and /etc/zeta unreadable by git (chroot UID resolution fails; creds-to-k8s runs kubectl as root with HOME=/home/zeta)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3K16QKA087G0R002GT2F8X-*.md` glob. -->
