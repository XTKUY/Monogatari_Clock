# 物语时钟 3D 素材

依据 `art/reference.png` 中的正面设计制作。表盘上半部为纯黑，下半部为暖白；使用繁体大写数字，11、12 点为竖排双字。指针、中心轴帽、黑色内圈和银色表壳均为独立的 3D 部件。

## 文件

| 文件 | 用途 |
| --- | --- |
| `models/monogatari-clock.glb` | 前端使用；已嵌入 4096 px 表盘贴图与 PBR 材质 |
| `models/monogatari-clock.blend` | Blender 可编辑工程；贴图已打包，含预览灯光、相机和背景 |
| `art/dial-4096.png` | 表盘的最终贴图 |
| `art/dial.svg` | 可编辑的表盘矢量排版源文件 |
| `art/dial-layout.json` | 字位、字体和颜色参数 |
| `art/reference.png` | 用户提供的原始设计图 |
| `renders/clock-preview.png` | Blender 渲染的正面预览 |
| `renders/clock-glb-roundtrip.png` | 将最终 GLB 重新导入 Blender 后的验证预览 |
| `tools/make_dial.py`、`tools/build_clock.py`、`tools/verify_glb.py` | 贴图、模型和导出验证脚本 |

## 前端使用

- GLB 采用 glTF 坐标：表盘正面朝 **+Z**，12 点朝 **+Y**，中心在原点。外径为 **0.30 米**。
- 模型的 `minute_hand_pivot` 和 `hour_hand_pivot` 分别控制分针与时针。初始角度按设计图设置为从 12 点顺时针约 **20°**、**216°**。转动时，在前端绕各自的 Z 轴设置负角度（顺时针）。
- 表盘文字已经烘焙进 GLB 内的贴图；浏览器无需安装中文字库。表壳使用金属 PBR 材质，建议在 3D 场景中提供环境贴图或面积光，以呈现银色反射。
- 预览场景的墙面与灯光只在 `.blend` 中，**不包含在 GLB** 里。

## 重新生成

需要 Blender 5.x、Python 3 和 Pillow。`tools/make_dial.py` 默认使用本机的 `SourceHanSerifSC-VF.ttf`；其他机器可设置 `CLOCK_FONT_PATH` 指向相近的中文衬线字体。前端直接使用现成 GLB 时，不依赖该字体或 Pillow。

```bash
python3 tools/make_dial.py
blender -b --factory-startup --python tools/build_clock.py
blender -b models/monogatari-clock.blend --python tools/verify_glb.py
```

参考图只有正面，因此背盖厚度和侧面细节是为 3D 展示补足的简洁结构。正面文字、分色位置、表圈比例和指针角度则按设计图测量制作。

最终 GLB 已重新导入 Blender 验证：4096 px 贴图、UV、材质和两个独立指针节点均保留。重新导入后的预览与 `.blend` 原场景的正面渲染一致。
