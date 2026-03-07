import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPersistedstate from 'pinia-plugin-persistedstate';
import './style.css';
import App from './App.vue';
import router from './router/index';

const pinia = createPinia();
pinia.use(piniaPersistedstate);

createApp(App).use(pinia).use(router).mount('#app');
