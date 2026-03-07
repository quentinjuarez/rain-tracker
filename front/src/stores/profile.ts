import { defineStore } from 'pinia';
import { type ProfileState, type LocationMode } from '../types';

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    position: null,
  }),

  getters: {
    hasPosition: (state) => state.position !== null,
  },

  actions: {
    setPosition(lat: number, lon: number, mode: LocationMode) {
      this.position = { lat, lon, mode };
    },
    clearPosition() {
      this.position = null;
    },
  },

  persist: true,
});
