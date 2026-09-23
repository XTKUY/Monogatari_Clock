# 版本备份

`v1/` 是添加秒针之前的第一版完整快照，保留原始的 Blender 工程、GLB、贴图、SVG、预览、脚本和说明。`v1/SHA256SUMS.txt` 记录了备份时每个文件的校验值。

如果只想查看第一版，直接打开 `v1/models/monogatari-clock.blend` 或加载 `v1/models/monogatari-clock.glb`，无需改动当前文件。

如果要把工作目录整体恢复为第一版，请先另存当前版本，再将 `v1/` 中对应的 `art/`、`models/`、`renders/`、`tools/` 文件及 `README.md` 复制回项目根目录。当前版本的额外文件（如斜角预览）可以保留，不影响第一版模型。
