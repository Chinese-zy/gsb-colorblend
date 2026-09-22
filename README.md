# colorblend

叠色已修复：完全透明不擦底、完全不透明内部不动、半透明按 source-over（先加后除）叠、交界只盖各自的边不外扩、缩放不改变落笔范围。页面入口 index.html（修前/修后 × 1x/3x 对比）。依赖：标准库即可，`npm install && npm test`。
