const std = @import("std");
pub fn build(b: *std.Build) void {
    const lib = b.addSharedLibrary(.{
        .name = "dla-canonical-zig",
        .root_source_file = b.path("dla-canonical.zig"),
        .target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .freestanding,
        }),
        .optimize = .ReleaseSmall,
    });
    lib.rdynamic = true;
    b.installArtifact(lib);
}
