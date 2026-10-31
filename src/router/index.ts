import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // Electron 生产模式通过 file:// 加载页面，createWebHistory 无法解析磁盘路径，
  // 改用 hash 路由（URL 形如 file:///.../index.html#/hot），与 Tauri 版路由保持一致
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      children: [
        { path: '', redirect: '/hot' },
        { path: 'hot', name: 'hot', component: () => import('@/views/HomeView.vue'), meta: { title: '热门推荐', icon: 'Flame' } },
        { path: 'acg', name: 'acg', component: () => import('@/views/AnimeView.vue'), meta: { title: '动漫精选', icon: 'AutoAwesome' } },
        { path: 'anime', redirect: '/acg' },
        { path: 'people', name: 'people', component: () => import('@/views/PeopleView.vue'), meta: { title: '人物精选', icon: 'Users' } },
        { path: 'collection', name: 'collection', component: () => import('@/views/CollectionView.vue'), meta: { title: '我的收藏', icon: 'Heart' } },
        { path: 'download', name: 'download', component: () => import('@/views/DownloadView.vue'), meta: { title: '下载中心', icon: 'Download' } },
        { path: 'downloads', redirect: '/download' },
        { path: 'about', name: 'about', component: () => import('@/views/AboutView.vue'), meta: { title: '关于', icon: 'Info' } },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '设置', icon: 'Settings' } },
      ],
    },
  ],
})

export default router
