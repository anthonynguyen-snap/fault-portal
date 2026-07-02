export const FAULT_TAXONOMY = {
  'Battery Swelling / Bulging': [],
  'Overheating': ['Device', 'Battery', 'Plug / adapter', 'Charging port', 'Unknown area', 'Other overheating issue'],
  'Fire / Smoke / Burning': ['Flame', 'Smoke', 'Burning smell', 'Burn marks', 'Other fire / smoke / burning issue'],
  'Electrical Short / Fuse / Spark': ['Short circuit', 'Blown fuse', 'Sparking / arcing', 'Melted connector', 'Other electrical safety issue'],
  'Dead on Arrival': [],
  'Charging / Power Fault': ['Will not recharge', 'Will not power on', 'Intermittent charging', 'Slow charging', 'Battery drains quickly', 'Will not hold charge', 'Other charging issue'],
  'Cable Fault': ['USB-C', 'Lightning', 'Other cable'],
  'Port Fault': ['USB-C', 'USB-A', 'Watch / accessory port', 'Other port'],
  'Wireless Charging Fault': ['Phone', 'AirPods / accessory', 'Watch', 'Other wireless charging issue'],
  'Plug / Adapter Fault': ['Broken / bent prong', 'Stuck adapter', 'Plug does not fit', 'Adapter not working', 'Other plug / adapter issue'],
  'Physical / Mechanical Fault': ['Casing / housing damage', 'Hinge damage', 'Detached component', 'Cracked component', 'Retract / extend mechanism', 'Locking mechanism', 'Kickstand', 'Vent hook', 'Stitching', 'Weak / detached magnet', 'Adhesive failure', 'Abnormal noise', 'Other physical / mechanical issue'],
  'Display / Indicator Fault': ['LCD / LED failure', 'Incorrect percentage', '188% error', 'Other display issue'],
  'Tracker / Connectivity Fault': ['Pairing failure', 'Connection lost', 'Reset unsuccessful', 'Other connectivity issue'],
  'Cosmetic / Manufacturing Defect': ['Discolouration', 'Residue', 'Dent / bump', 'Poor finish', 'Other manufacturing defect'],
  'Other / Not Yet Identified': [],
} as const;

export type FaultParentType = keyof typeof FAULT_TAXONOMY;

export const FAULT_PARENT_TYPES = Object.keys(FAULT_TAXONOMY) as FaultParentType[];

export const SAFETY_FAULT_TYPES = new Set<FaultParentType>([
  'Battery Swelling / Bulging',
  'Overheating',
  'Fire / Smoke / Burning',
  'Electrical Short / Fuse / Spark',
]);

export function isFaultParentType(value: string): value is FaultParentType {
  return Object.prototype.hasOwnProperty.call(FAULT_TAXONOMY, value);
}

export function getFaultSubtypes(parent: string): readonly string[] {
  return isFaultParentType(parent) ? FAULT_TAXONOMY[parent] : [];
}

export function isValidFaultSubtype(parent: string, subtype: string): boolean {
  const subtypes = getFaultSubtypes(parent);
  return subtypes.length === 0 ? !subtype : subtypes.includes(subtype as never);
}

export function requiresFaultNotes(parent: string, subtype = ''): boolean {
  return (
    parent === 'Other / Not Yet Identified' ||
    (isFaultParentType(parent) && SAFETY_FAULT_TYPES.has(parent)) ||
    subtype.toLowerCase().startsWith('other ')
  );
}
