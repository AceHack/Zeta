# full-ai-cluster/nixos/tests/k3s-first-boot-apply-order-eval-test.nix
#
# Properties of the FIRST-BOOT MANIFEST ROSTER -- the `services.k3s.manifests`
# attrset a control-plane node auto-applies before anything else exists.
#
# WHY THIS FILE EXISTS
# --------------------
# Nothing had ever exercised that roster. Every VM test in this directory
# overrides it away:
#
#   k3s-cluster-init.nix:63              manifests = lib.mkForce { }
#   k3s-agent-join.nix:60                manifests = lib.mkForce { }
#   k3s-control-plane-platform-fixes:49  manifests = lib.mkForce { }
#   k3s-cluster-online.nix:49            reduced to cilium only
#   longhorn-volume-binds.nix:71         reduced to cilium + longhorn
#
# Each override is defensible on its own (a sandboxed VM cannot pull images).
# Together they mean the declared boot sequence has no test at all, and the
# roster's own ordering comment drifted into being FALSE without anything
# noticing. `k3s-first-boot-roster.nix` is the VM test that applies the real
# thing; it needs internet, a KVM host, and ~45 minutes. This file is the half
# that costs a PR nothing and runs on every platform.
#
# NOT a VM test. Like secure-boot-desired-state-eval-test.nix it is a pure
# evaluation test: it throws on failure, so forcing its value IS running it.
# `flake.nix` forces it inside `checks.<system>.k3s-first-boot-apply-order`,
# which `nix flake check --no-build` evaluates on every PR.
#
# WHAT IT CANNOT TELL YOU. Every property below is about Nix values and file
# TEXT. None of them boots a node, applies a manifest, or observes k3s. In
# particular it CANNOT answer the question the VM test exists for -- whether
# the k3s deploy controller RETRIES an apply whose kind does not yet exist. It
# can only prove that the situation arises, which is the half that is
# checkable without hardware.

{ lib, pkgs }:

let
  modulesDir = ../modules;

  # -- The roster, as a control-plane node actually assembles it -----------
  #
  # hosts/control-plane/configuration.nix imports exactly two modules that
  # contribute to the manifest roster. Reading them separately, and merging
  # here, is what lets this check assert that they do not collide; a single
  # merged read could not see a collision at all.
  contributingModules = {
    k3s-server = import (modulesDir + "/k3s-server.nix");
    local-storage = import (modulesDir + "/local-storage.nix");
  };

  # Neither module references `config`, so calling them directly is sound and
  # avoids a full NixOS eval (fast, and it works on aarch64-darwin). P0 below
  # is the guard that keeps that assumption honest.
  moduleArgs = {
    config = { };
    inherit lib pkgs;
  };

  rosters = lib.mapAttrs (_: m: (m moduleArgs).services.k3s.manifests) contributingModules;

  # A `lib.mkMerge` / `lib.mkIf` wrapper is an attrset carrying `_type`, and
  # `builtins.attrNames` on one yields a two-element list rather than the
  # roster -- silently producing a WRONG roster. So it is refused.
  # (nixos/modules/gpu-device-plugin.nix already uses mkMerge, so this is a
  # shape that exists in-tree, not a hypothetical.)
  isPlainAttrs = v: builtins.isAttrs v && !(v ? _type);

  rosterNames = lib.mapAttrs (_: builtins.attrNames) rosters;
  allNames = lib.concatLists (builtins.attrValues rosterNames);
  duplicateNames = lib.subtractLists (lib.unique allNames) allNames;

  merged = lib.foldl' (a: b: a // b) { } (builtins.attrValues rosters);
  mergedNames = builtins.attrNames merged;

  # -- The filename each entry becomes ------------------------------------
  #
  # Replicates mkManifestTarget from the PINNED nixpkgs
  # (rev b77b3de8775677f84492abe84635f87b0e153f0f,
  #  nixos/modules/services/cluster/rancher/default.nix lines 34-41):
  #
  #   if hasSuffix ".yaml"/".yml"/".json" name then name else name + ".yaml"
  #
  # with `target = lib.mkDefault (mkManifestTarget name)` at line 384, linked
  # into `manifestDir = /var/lib/rancher/k3s/server/manifests` at line 27.
  #
  # `target` is mkDefault, so an entry MAY override it -- in which case this
  # reconstruction would be wrong. P0 refuses that case rather than guessing.
  mkManifestTarget =
    name:
    if lib.hasSuffix ".yaml" name || lib.hasSuffix ".yml" name || lib.hasSuffix ".json" name then
      name
    else
      name + ".yaml";

  targetOf = name: mkManifestTarget name;

  # Nix string `<` is bytewise, matching the Go sort of the directory listing
  # the k3s deploy controller walks. This is SUBMISSION order -- see P5.
  appliedOrder = builtins.sort (a: b: a < b) (map targetOf mergedNames);

  # -- The pinned expectation (a golden vector for the boot sequence) ------
  #
  # Changing the roster changes this list, deliberately: a maintainer adding a
  # manifest has to look at where it lands in the apply order and say so here.
  expectedAppliedOrder = [
    "aa-gateway-api-crds.yaml"
    "argocd-install.yaml"
    "argocd-namespace.yaml"
    "cert-manager-install.yaml"
    "cilium-install.yaml"
    "cilium-namespace.yaml"
    "external-secrets-install.yaml"
    "local-path-provisioner.yaml"
    # Added 2026-08-22 with the trust-manager trust-namespace move. It sorts
    # here, which is BEFORE trust-manager-install.yaml — the one ordering
    # property it needs, since trust-manager's Secrets Role is created in this
    # namespace and a Role into a missing namespace fails.
    "openziti-namespace.yaml"
    "root-application.yaml"
    "spire-install.yaml"
    "trust-manager-install.yaml"
  ];

  # -- Reading the manifests themselves -----------------------------------
  #
  # Only an entry whose `source` is a real path literal can be read here. An
  # entry built with `pkgs.writeText` (local-storage.nix) is a derivation, and
  # reading it in a pure eval would force a build -- so it is NOT read. It is
  # declared below instead, and the text of its own module stands in. Naming
  # what was not opened is the point: a check that silently skips an input is
  # the vacuity class.
  hasPathSource = name: (merged.${name} ? source) && builtins.isPath merged.${name}.source;

  pathSourced = builtins.filter hasPathSource mergedNames;
  nonPathSourced = builtins.filter (n: !(hasPathSource n)) mergedNames;

  # Entries this check cannot open, each standing in via its module text.
  declaredInlineSources = [ "local-path-provisioner" ];

  sortStrings = builtins.sort (a: b: a < b);

  k3sServerText = builtins.readFile (modulesDir + "/k3s-server.nix");
  localStorageText = builtins.readFile (modulesDir + "/local-storage.nix");

  manifestTexts = lib.listToAttrs (
    map (n: lib.nameValuePair n (builtins.readFile merged.${n}.source)) pathSourced
  );

  allText = lib.concatStringsSep "\n" (
    builtins.attrValues manifestTexts ++ [ k3sServerText localStorageText ]
  );

  countOccurrences = needle: haystack: builtins.length (lib.splitString needle haystack) - 1;

  # Every `apiVersion: <group>/<version>` (or bare `v1`) declared in a file.
  apiVersionsIn =
    text:
    lib.unique (
      lib.remove null (
        map (
          line:
          let
            m = builtins.match "[[:space:]]*apiVersion:[[:space:]]+([^[:space:]]+)[[:space:]]*" line;
          in
          if m == null then null else builtins.head m
        ) (lib.splitString "\n" text)
      )
    );

  groupOf =
    apiVersion:
    let
      parts = lib.splitString "/" apiVersion;
    in
    if builtins.length parts == 1 then "" else builtins.head parts;

  # API groups a manifest may rely on at the instant the deploy controller
  # applies it, on a node where NOTHING has run yet:
  #   ""                        core (v1)
  #   apps / rbac / storage / apiextensions / batch / networking / policy
  #                             Kubernetes built-ins
  #   helm.cattle.io            k3s installs the helm-controller CRDs itself
  #   gateway.networking.k8s.io established by aa-gateway-api-crds.yaml,
  #                             which P4 pins as the FIRST file applied
  firstBootAvailableGroups = [
    ""
    "apps"
    "rbac.authorization.k8s.io"
    "storage.k8s.io"
    "apiextensions.k8s.io"
    "batch"
    "networking.k8s.io"
    "policy"
    "helm.cattle.io"
    "gateway.networking.k8s.io"
  ];

  # -- The quarantine -----------------------------------------------------
  #
  # A manifest whose kind is created by a HELM CHART cannot be applied
  # successfully at first boot: the deploy controller submits every file in
  # one pass within seconds, while the helm-controller install Job that
  # creates the CRD takes minutes. root-application.yaml is an
  # argoproj.io/v1alpha1 Application and the ArgoCD chart is what creates
  # that CRD -- so it is submitted before its kind can exist, every boot.
  #
  # Whether that self-heals depends on the deploy controller RETRYING, which
  # nothing in this repo has measured. tests/k3s-first-boot-roster.nix is the
  # VM test that would measure it. Until then this list is the record that the
  # hazard exists and that it is exactly ONE manifest.
  #
  # NOTE for whoever tries to fix this by renaming: renaming does NOT help.
  # The order below is SUBMISSION order, not completion order, so
  # `zz-root-application` is still submitted seconds after the ArgoCD
  # HelmChart CR and still long before that chart Job has created the CRD.
  appliedBeforeItsKindCanExist = [ "root-application.yaml" ];

  offendersMeasured = lib.unique (
    lib.concatLists (
      lib.mapAttrsToList (
        n: text:
        let
          bad = builtins.filter (
            a: !(builtins.elem (groupOf a) firstBootAvailableGroups)
          ) (apiVersionsIn text);
        in
        if bad == [ ] then [ ] else [ (targetOf n) ]
      ) manifestTexts
    )
  );

  # -- Storage: exactly one default StorageClass at first boot ------------
  defaultClassAnnotation = ''storageclass.kubernetes.io/is-default-class: "true"'';
  serverExtraFlags = (contributingModules.k3s-server moduleArgs).services.k3s.extraFlags;

  check = name: cond: { inherit name; ok = cond; };

  results = [
    # -- P0 the reader keeps its own assumptions honest --------------------
    (check "every contributing roster is a plain attrset (no mkMerge wrapper this reader would misread)" (
      lib.all isPlainAttrs (builtins.attrValues rosters)
    ))
    (check "no two modules declare the same manifest name (a collision is a silent overwrite)" (
      duplicateNames == [ ]
    ))
    (check "no entry overrides `target`, so <name>.yaml is the exact deployed filename" (
      builtins.all (n: !(merged.${n} ? target)) mergedNames
    ))
    (check "every entry this check could not open is declared (nothing is silently skipped)" (
      sortStrings nonPathSourced == sortStrings declaredInlineSources
    ))

    # -- P1 the merge is real, not one module wearing both hats ------------
    (check "the merged roster is the union of both modules" (
      builtins.length mergedNames == builtins.length allNames
      && builtins.length mergedNames > builtins.length rosterNames.k3s-server
    ))

    # -- P2 the apply order, pinned ---------------------------------------
    # Sorted on the FILENAME, suffix included. Sorting attribute names instead
    # would be a different order the moment two names share a prefix.
    (check "the first-boot apply order is exactly the pinned sequence" (
      appliedOrder == expectedAppliedOrder
    ))

    # -- P3 what the old comment claimed, measured -------------------------
    # The roster comment said "ArgoCD comes LAST". It does not: the ArgoCD
    # chart is submitted SECOND. Asserting the true fact is what stops the
    # corrected comment drifting back to the false one.
    (check "the ArgoCD chart is submitted SECOND, not last (the old comment was wrong)" (
      builtins.elemAt appliedOrder 1 == "argocd-install.yaml"
    ))
    (check "every *-install file with a sibling *-namespace file sorts BEFORE it" (
      builtins.all (
        n:
        let
          ns = lib.removeSuffix "-install.yaml" n + "-namespace.yaml";
        in
        !(builtins.elem ns appliedOrder) || n < ns
      ) (builtins.filter (lib.hasSuffix "-install.yaml") appliedOrder)
    ))

    # -- P3b the SECOND ordering property that is load-bearing -------------
    # trust-manager's Role over Secrets is created in its TRUST NAMESPACE,
    # which k8s/bootstrap/trust-manager-install.yaml points at `openziti`. A
    # Role applied into a namespace that does not exist fails, so the Namespace
    # must be submitted first. Unlike the `aa-` prefix below this needs no
    # prefix -- `o` < `t` already -- which is exactly why it deserves an
    # assertion: nothing in either filename says the order is deliberate, so a
    # rename could silently reverse it.
    (check "openziti-namespace.yaml is submitted before trust-manager-install.yaml" (
      builtins.elem "openziti-namespace.yaml" appliedOrder
      && builtins.elem "trust-manager-install.yaml" appliedOrder
      && "openziti-namespace.yaml" < "trust-manager-install.yaml"
    ))

    # -- P4 the one ordering property that IS load-bearing -----------------
    # The Gateway API CRDs must exist before Cilium and cert-manager start or
    # cert-manager crash-loops "Gateway API CRDs do not seem to be present"
    # (observed on node-09485d: 869 restarts over 3 days). The `aa-` prefix is
    # the entire mechanism; this assertion notices if it is ever dropped.
    (check "aa-gateway-api-crds.yaml is submitted FIRST (the aa- prefix is load-bearing)" (
      builtins.head appliedOrder == "aa-gateway-api-crds.yaml"
    ))

    # -- P5 the quarantine ------------------------------------------------
    (check "exactly the declared set of manifests is submitted before its kind can exist" (
      sortStrings offendersMeasured == sortStrings appliedBeforeItsKindCanExist
    ))
    (check "root-application is the only rostered file naming an argoproj.io kind" (
      builtins.elem "argoproj.io/v1alpha1" (apiVersionsIn manifestTexts.root-application)
      && builtins.all (t: !(builtins.elem "argoproj.io/v1alpha1" (apiVersionsIn t))) (
           builtins.attrValues (builtins.removeAttrs manifestTexts [ "root-application" ])
         )
    ))

    # -- P6 exactly one default StorageClass at first boot -----------------
    # Two classes both marked default is an ambiguous config in which a
    # class-less PVC binds non-deterministically (observed on node-09485d,
    # 2026-06-07). Three independent legs; removing any one goes red.
    (check "the k3s bundled local-storage addon is disabled (leg 1)" (
      builtins.elem "--disable=local-storage" serverExtraFlags
    ))
    (check "exactly one default-StorageClass annotation exists in the whole first-boot set (leg 2)" (
      countOccurrences defaultClassAnnotation allText == 1
    ))
    (check "the one default class is named zeta-local-path (leg 3)" (
      countOccurrences "\n        name: zeta-local-path\n" localStorageText == 1
    ))
  ];

  failures = builtins.filter (r: !r.ok) results;
in
{
  inherit
    results
    failures
    appliedOrder
    offendersMeasured
    ;

  # Forcing `status` runs every property. It is a string on success and a
  # throw naming every broken property on failure -- so a consumer that merely
  # evaluates it (flake.nix) cannot pass while a property is red.
  status =
    if failures == [ ] then
      "k3s first-boot apply order: ${toString (builtins.length results)} properties held over "
      + "${toString (builtins.length appliedOrder)} manifests; submission order = "
      + lib.concatStringsSep " -> " appliedOrder
    else
      throw "k3s first-boot apply order FAILED: ${lib.concatStringsSep "; " (map (r: r.name) failures)}";
}
