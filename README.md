# 保有数 · 我的社保账本

中文个人社保与公积金情景测算应用，上海规则底稿核查至2026-10-23。以 VoltAgent/awesome-design-md 中 Mercury 设计指南为参考，使用圆角卡片、左侧图标导航与柔和模块色。

设计参考：https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/mercury/DESIGN.md

## 使用

- 在“个人信息”填入城市、出生年月、工作年份、实际扣款及余额。首次打开是明确标注的示例资料。
- 默认按参加工作时间连续缴费推算，支持养老/医保/公积金年限分别覆盖。
- 提供九项保障与决策页面，以及独立灵活就业、个人资料和政策个税页面。
- 所有填报数据自动存入当前浏览器 localStorage，可导出 JSON 备份。服务器不接收个人工资及账户信息。
- 政策查询仅发送城市与主题，读取公开政府目录和政府域名搜索结果。缺失或不可用会明确说明。查询结果不自动改写测算规则。

## 计算边界

上海以外城市可查询政策，但不套用上海地方待遇。账户余额为填报或简化估算；贷款额度仅为必要约束下上界；待遇资格须行政经办核定。养老金为当前工资水平和自设增长率情景，非未来收益保证。

单位失业保险2026延续比例未核实，默认未知，单位与年度成本标“已知部分”。2026公积金年度通知正文未完整取得，引用官方年度表及缴存办法并明确说明。生育医疗采用2026-10-01新规，2027-05灵活就业新条件按事件日期切换。

公式与来源在 lib/profile.ts、retirement.ts、housing.ts、benefits.ts、policies.ts；页面内可展开官方来源及日期。

## 本地开发

Node 22.13+；本项目已安装依赖。

- `npm run dev`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node --import ./tests/resolve.mjs --test tests/*.test.ts`（测试运行器使用Node 26类型剥离）
- `npm run build`

通过 Sites 工作流部署；保留 .openai/hosting.json 中既有项目身份。不要提交凭证或浏览器个人档案。
