# 项目约定

## GitHub Pages 发布

- 本项目的变更完成后，必须在本地验证通过，再提交并推送到 `main`，通过 GitHub Actions 的 `.github/workflows/deploy.yml` 重新部署 GitHub Pages。
- 推送后必须检查对应 Actions workflow run 结果为成功，并请求线上 Pages URL 确认页面可访问；不能只以本地构建成功或代码已推送作为完成依据。
- 如果 Actions 或线上验证失败，应定位并修复后重新验证、推送和部署，直到成功；最终回复需给出部署运行链接和线上验证结果。
- 仅暂存本次任务涉及的明确文件，勿将 `.scaffold-301/`、`visualization/` 等未纳入项目发布的目录或其他会话的改动带入提交。
