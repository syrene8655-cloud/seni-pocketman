<p align="center"><img src="assets/brand-pair.svg" width="480" alt="SENI / POCKETMAN"></p>

# 把音乐装进一盘磁带

> **请勿商用 / Noncommercial use only.**

SENI / POCKETMAN 是一个可以在本地运行的磁带音乐播放器。银色机身、会转动的白色轴、机械按钮和橙色磁带架，把熟悉的听歌动作带回浏览器。

A tactile cassette player for your browser. Load a tape, press play, and take your time.

[English](README.md) · 简体中文

## 可以做什么

- 直接播放内置原创演示曲《霓虹夜行》，无需登录。
- 导入自己的音频文件，读取歌曲信息与内嵌封面。
- 用磁带架整理曲目，查看磁带 A / B 面、切换外壳配色。
- 播放、暂停、停止、切歌、调节音量与进度，配有机械按键音。
- 可选连接网易云音乐或 Apple Music，使用自己的账号与播放权限。

首次打开默认英文，可在「外观 → 语言」中切换中文 / English，选择会保存在浏览器中，切换不打断播放。

默认仅包含一首演示音乐及其封面。联网后显示的歌曲、专辑封面由你连接的音乐服务提供，不随本仓库分发。

## 本地运行

安装 **Node.js 22 或更高版本**，下载本仓库并解压，在项目目录执行：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

然后打开 **http://127.0.0.1:8768/**。macOS 也可以在安装 Node.js 后双击 `启动.command`。

使用 `127.0.0.1` 访问；当前来源校验不接受 `localhost`。端口冲突时可执行 `PORT=8770 npm start`，并访问相应端口。终端按 `Ctrl+C` 停止。

这是 HTML / CSS / JavaScript 前端与 Node.js 服务组成的项目。完整功能需要本地服务，不能通过双击 `index.html` 或仅上传 GitHub Pages 来运行。

## 音乐服务

**网易云音乐**：在播放器设置中扫码登录。登录状态保存在该服务进程内存中；停止或重启服务后需要重新扫码。歌曲可用性、会员、试听与地区限制遵循服务返回结果。

**Apple Music**：需要自行配置 MusicKit 开发者密钥，并使用有播放权限的 Apple Music 账号。参见 [可选配置](docs/configuration.md)。仓库不包含开发者私钥或账号凭证。

本地导入的文件由浏览器读取。文件引用不会跨刷新永久保留，重新打开页面后可能需要重新导入。不要把浏览器本地列表当作音乐文件备份。

## 加载与隐私

进度条按 10 秒估计准备进度；必要素材提前完成就立即进入，超过 10 秒则继续等待素材。长时间失败时提供重试提示。

GitHub 版本没有正式站的监测上报。使用音乐平台功能时仍需请求相应服务；演示曲、本地图片和按键音均随包提供。

## 开发

无前端构建步骤，修改后刷新页面即可。

```sh
npm test
```

| 文件 | 用途 |
| --- | --- |
| `index.html` / `style.css` | 页面与样式 |
| `player.js` / `hardware-controls.js` | 播放与实体按钮交互 |
| `racks.js` / `geometry.js` | 磁带架与素材定位 |
| `server.cjs` | 本地静态文件与音乐接口 |
| `assets/` | 当前版本使用的素材 |
| `tests/` | 后端与来源校验测试 |

## 许可

**允许非商业使用、学习、修改和分享；商业使用未获授权。** 本项目采用 [PolyForm Noncommercial 1.0.0](LICENSE.md)，因此按「源码公开 / source-available」发布，而非允许商业使用的开放源代码许可。具体授权以许可全文为准。

Required Notice: Copyright 2026 syrene8655-cloud

项目内第三方代码和 Kenney 按键音保留各自许可，不受本项目新增的商业限制替代。视觉素材包含 AI 辅助生成与人工处理内容；素材来源和分发范围见 [第三方说明](THIRD_PARTY_NOTICES.md)。SENI / POCKETMAN 是本项目的显示名称，不代表与音乐平台或硬件厂商存在合作关系。
