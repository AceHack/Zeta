#!/bin/bash
set -e
for pr in 4770 4766 4765 4764 4763 4762 4761 4758 4757 4756 4755 4754; do
  bun run tools/pr-preservation/archive-pr.ts $pr
done
