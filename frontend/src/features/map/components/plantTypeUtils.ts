/**
 * plantTypeUtils.ts — Shared plant type display helpers for map components.
 *
 * Single source of truth for icon, colour, background colour, and label per
 * plant type. Used by both MapPage (desktop detail panel) and MapBottomSheet
 * (mobile detail sheet) to avoid duplicating the same ternary chains.
 */

import { Factory, Warehouse, Anchor, Building2, type LucideIcon } from 'lucide-react';

export interface PlantTypeInfo {
  /** Lucide icon component for this plant type */
  Icon: LucideIcon;
  /** Hex colour for the icon itself */
  iconColor: string;
  /** Hex background colour for the icon container */
  iconBg: string;
  /** Human-readable type label */
  typeLabel: string;
}

/**
 * Returns display info for a plant's admin-managed plant_type
 * (factory | terminal | hq | depot). Falls back to Distribution Depot for
 * any other/unrecognised value.
 */
export function getPlantTypeInfo(plantType: string): PlantTypeInfo {
  if (plantType === 'factory')  return { Icon: Factory,   iconColor: '#F59E0B', iconBg: '#FEF3C7', typeLabel: 'Cement Factory'      };
  if (plantType === 'terminal') return { Icon: Anchor,    iconColor: '#DC2626', iconBg: '#FEE2E2', typeLabel: 'Port / Terminal'      };
  if (plantType === 'hq')       return { Icon: Building2, iconColor: '#16A34A', iconBg: '#DCFCE7', typeLabel: 'Corporate / HQ'      };
  return                          { Icon: Warehouse,  iconColor: '#2563EB', iconBg: '#DBEAFE', typeLabel: 'Distribution Depot' };
}
