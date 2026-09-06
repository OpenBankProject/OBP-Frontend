/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { writable } from "svelte/store";

interface ApiActivityState {
  isActive: boolean;
  activeCallsCount: number;
}

function createApiActivityStore() {
  const { subscribe, set, update } = writable<ApiActivityState>({
    isActive: false,
    activeCallsCount: 0,
  });

  let hideTimer: number | null = null;

  return {
    subscribe,
    startCall: () => {
      update((state) => {
        const newCount = state.activeCallsCount + 1;
        return {
          isActive: true,
          activeCallsCount: newCount,
        };
      });

      // Clear any pending hide timer
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    },
    endCall: () => {
      update((state) => {
        const newCount = Math.max(0, state.activeCallsCount - 1);
        return {
          isActive: newCount > 0,
          activeCallsCount: newCount,
        };
      });

      // If no active calls, set a timer to hide the indicator
      // This creates a brief flash effect
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        update((state) => {
          if (state.activeCallsCount === 0) {
            return { isActive: false, activeCallsCount: 0 };
          }
          return state;
        });
      }, 3000);
    },
  };
}

export const apiActivity = createApiActivityStore();
