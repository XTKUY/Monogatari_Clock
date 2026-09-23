# 前端技术说明

## 技术组成

- 包管理：pnpm，依赖版本记录在 `pnpm-lock.yaml`。
- 构建：Vite 8 + TypeScript。`vite.config.ts` 使用相对部署路径，`pnpm build` 同时进行类型检查与静态构建。
- 三维：Three.js `WebGLRenderer`、`GLTFLoader`、`OrbitControls`。交互界面使用原生 HTML/CSS，不依赖服务端。
- 校验：Vitest 负责时间状态与时区逻辑；构建负责 TypeScript 和静态资源打包。

入口是 `index.html` 和 `src/main.ts`。`src/time.ts` 管理时间状态、时区转换和三根指针的角度；`src/scene.ts` 管理 GLB、相机、墙面、灯光与鼠标控制；`src/styles.css` 定义桌面与移动布局。

## 时间模型

页面初始为 **实时同步**：使用 `Date.now()` 取得当前绝对时刻，使用 `Intl.DateTimeFormat().resolvedOptions().timeZone` 检测本机时区。用户可选有效的 IANA 时区，选择保存在本机 `localStorage`。手动时区只改变钟面与日期的显示；切换时区时，绝对时刻保持不变。在页面重新可见时，会重新检测本机时区；手动选择的时区不受影响。

**暂停**会把当时的绝对时刻保存为模拟时间锚点。拨针时按所选时区读取该时刻的时、分或秒，旋钮设置相应单位，并自动暂停。旋钮跨越 `59→00` 或 `23→00` 时取最短方向，避免意外跳回一整圈。**运行**从锚点继续推进，推进量由 `performance.now()` 计算，因此改变系统时钟不会使模拟时间跳变。**回到实时**重新使用 `Date.now()`。

秒针连续走动，分针与时针随秒和毫秒平滑前进。12 点方向为 +Y，从 +Z 正面看，三个 pivot 绕 Z 轴的负角度为顺时针。GLB 中保存的初始角度只是预览姿态，运行时直接写入当前的绝对角度。时区夏令时切换由浏览器的 `Intl` 时区数据库转换；在不存在的本地小时上拨针时，模拟时刻按实际经过的小时推进，显示会遵循该时区的跳时规则。

## 三维素材与场景

`src/main.ts` 使用 Vite 的 `?url` 导入 `models/monogatari-clock.glb`，不会改动源文件。该 GLB 包含独立的 `hour_hand_pivot`、`minute_hand_pivot`、`second_hand_pivot` 与嵌入的 4096 px 表盘贴图。加载时检查三个 pivot 是否存在；模型正面是 +Z，12 点是 +Y，外径为 0.30 m。

墙面视图使用正交相机，建立一块接收阴影的浅鼠尾草色墙面；空间视图隐藏墙面，使用透视相机和 `OrbitControls`。鼠标映射为左键旋转、中键平移、滚轮缩放；移动指针的轻微视差只在空间模式启用，系统设置“减少动态效果”时关闭视差。空间相机可重置。

金属表壳的反射来自 Three.js `RoomEnvironment` 生成的环境贴图，另有主光、补光、轮廓光和柔和阴影。光线开关和强度滑块同时调节直接照明与环境反射。浏览器实时光照和 Blender Cycles 预览不会完全一致。原模型的白色时针和分针在暖白下半盘上对比度较低，因此加载后仅在浏览器内把两种指针漆面调成冷银灰，并加一层很薄的偏移阴影；原 GLB、`.blend`、SVG 和 PNG 均保持原样。

画布的像素比例上限为 1.8，渲染循环约每秒 30 帧。屏幕使用“减少动态效果”时进一步降低帧率。WebGL 初始化或模型载入失败时，保留 `renders/clock-preview.png` 静态预览并显示原因；页面时间文本仍会继续更新。当前 GLB 传输体积约 0.94 MiB，但 4096 px 贴图在 GPU 上解码后占用远高于文件大小，移动设备需要实机性能检查。

当前生产 JavaScript 约 650 kB（gzip 后约 164 kB），主要是 Three.js。Vite 会提示单个 chunk 超过 500 kB；目前页面可以正常加载，后续如需缩短首次下载时间，可按需拆分三维模块。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```

时间单元测试覆盖实时/暂停/模拟运行、时区转换、旋钮跨界和连续指针角度。交互验收还应检查 WebGL 模型加载、手机宽度布局、墙面与空间切换、中键平移、光影开关和异常时的静态预览。浏览器至少需要 WebGL 2；Three.js 的 `WebGLRenderer` 当前基于 WebGL 2。

相关文档：[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)、[Scene environment](https://threejs.org/docs/pages/Scene.html)、[Vite 静态资源](https://vite.dev/guide/assets.html)。
