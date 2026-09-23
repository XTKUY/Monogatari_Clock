# 物语时钟

基于本仓库的 Blender / GLB 美术素材制作的交互式三维时钟。默认读取本机时区和当前时间，也可以选择其他时区、暂停拨针、控制光影，并在墙面视图与独立空间视图之间切换。

## 启动前端

需要 Node.js 22.12+ 和 pnpm。本项目当前使用 Vite、TypeScript 与 Three.js，无需后端服务。

```bash
pnpm install
pnpm dev
```

打开终端显示的本地地址。生产构建和检查：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

`dist/` 是可部署的静态站点；构建会从 `models/monogatari-clock.glb` 复制带哈希文件名的模型，不需要手工复制或重新导出。静态预览图用作载入过程和 WebGL 不可用时的展示。

## 页面操作

- **时间与时区**：首次打开自动检测本机时区。可输入 `Asia/Shanghai`、`Europe/London` 等 IANA 时区，或输入唯一的城市名；手动选择会保存在当前浏览器。点“本机”恢复自动检测。时区切换只改变显示方式，不改变所代表的同一时刻。
- **暂停与拨针**：点“暂停”冻结当前时刻。选择时针、分针或秒针，拖动旋钮或用方向键调整；拨针会自动暂停。点“运行”会从调整后的时刻继续，点“回到实时”则立即回到系统当前时间。时针旋钮按 24 小时设置，钟面仍按 12 小时显示。
- **观察方式**：墙面模式保持正对钟面的视角。空间模式隐藏墙面；移动鼠标有轻微视差，左键拖动旋转，中键拖动平移，滚轮缩放；触屏单指旋转、双指移动与缩放。“重置视角”恢复初始空间视角。
- **光影**：可关闭展示灯光，或把亮度设为 0%–200%。关闭时保留微弱环境光，仍能看见钟表。

前端实现与时间语义见 [TECHNICAL.md](TECHNICAL.md)，版本记录见 [CHANGELOG.md](CHANGELOG.md)。

## 3D 素材 · 第二版

依据 `art/reference.png` 中的正面设计制作。表盘上半部为纯黑，下半部为暖白；使用繁体大写数字，11、12 点为竖排双字。第二版增加了独立秒针、分层指针、略厚的银色表框，以及上白下黑的盘内圆环。第一版完整保存在 `versions/v1/`。

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
| `renders/clock-angle-preview.png` | 显示表框厚度和指针层次的斜角预览 |
| `renders/clock-glb-roundtrip.png` | 将最终 GLB 重新导入 Blender 后的验证预览 |
| `versions/v1/` | 添加秒针前的第一版完整备份，可直接打开旧版 `.blend` / `.glb` |
| `tools/make_dial.py`、`tools/build_clock.py`、`tools/verify_glb.py` | 贴图、模型和导出验证脚本 |

## 前端使用

- GLB 采用 glTF 坐标：表盘正面朝 **+Z**，12 点朝 **+Y**，中心在原点。外径为 **0.30 米**。
- `hour_hand_pivot`、`minute_hand_pivot`、`second_hand_pivot` 分别控制时针、分针和秒针。初始角度从 12 点顺时针分别为 **216°、20°、340°**。转动时，在前端绕各自的 Z 轴设置负角度（顺时针）。
- 时针采用缎面象牙白，分针采用光泽白，秒针采用缎面银和细窄亮面中心线。三者有不同的实际前后高度、金属边缘与凸起脊线；秒针最靠前，压在白色中心轴帽之上。
- 表盘外侧的双色圆环是独立、微微凸起的几何体，也在表盘贴图中留有同色底线；上半段白色、下半段黑色。
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

最终 GLB 已重新导入 Blender 验证：4096 px 贴图、UV、材质、双色圆环和三个独立指针节点均保留。重新导入后的预览与 `.blend` 原场景的正面渲染一致。
