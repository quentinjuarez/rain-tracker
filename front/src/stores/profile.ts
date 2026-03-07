import { defineStore } from 'pinia';
import { type ProfileState } from '../types';

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({}),

  getters: {},

  actions: {},

  persist: true,
});
