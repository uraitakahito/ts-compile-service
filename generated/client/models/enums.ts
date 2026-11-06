// smithy-typescript generated code
/**
 * @public
 * @enum
 */
export const ParamKind = {
  VARIABLE: "variable",
} as const;
/**
 * @public
 */
export type ParamKind = (typeof ParamKind)[keyof typeof ParamKind];

/**
 * @public
 * @enum
 */
export const Phase = {
  BEHAVIOR: "behavior",
  PRELOAD: "preload",
} as const;
/**
 * @public
 */
export type Phase = (typeof Phase)[keyof typeof Phase];
