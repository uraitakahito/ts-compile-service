const _C = "Compile";
const _CF = "CompileFailed";
const _CI = "CompileInput";
const _CO = "CompileOutput";
const _D = "Declaration";
const _DL = "DeclarationList";
const _DLi = "DiagnosticList";
const _DP = "DeclaredParam";
const _DPL = "DeclaredParamList";
const _Di = "Diagnostic";
const _GH = "GetHealth";
const _GHO = "GetHealthOutput";
const _PS = "ParamSchema";
const _S = "Script";
const _SHM = "SourceHashMismatch";
const _SL = "ScriptList";
const _VE = "ValidationException";
const _VEF = "ValidationExceptionField";
const _VEFL = "ValidationExceptionFieldList";
const _c = "client";
const _ca = "cached";
const _co = "code";
const _col = "col";
const _d = "diagnostics";
const _de = "declarations";
const _e = "error";
const _en = "enum";
const _f = "file";
const _fL = "fieldList";
const _h = "http";
const _hE = "httpError";
const _hT = "hostTypes";
const _i = "id";
const _k = "kind";
const _l = "line";
const _m = "message";
const _mL = "minLength";
const _mLa = "maxLength";
const _mV = "missingVariables";
const _n = "name";
const _o = "ok";
const _op = "options";
const _p = "path";
const _pa = "params";
const _ph = "phase";
const _r = "required";
const _s = "smithy.ts.sdk.synthetic.ts.compile";
const _sc = "scripts";
const _sch = "schema";
const _sh = "sha256";
const _so = "source";
const _su = "summary";
const _t = "typescript";
const _ty = "type";
const _u = "unreadable";
const _v = "version";
const _vN = "variableNames";
const n0 = "smithy.framework";
const n1 = "ts.compile";

// smithy-typescript generated code
import { TypeRegistry } from "@smithy/core/schema";
import type { StaticErrorSchema, StaticListSchema, StaticOperationSchema, StaticStructureSchema } from "@smithy/types";

import { CompileFailed, SourceHashMismatch, ValidationException } from "../models/errors";
import { TsCompileServiceException } from "../models/TsCompileServiceException";

/* eslint no-var: 0 */
const _s_registry = TypeRegistry.for(_s);
export var TsCompileServiceException$: StaticErrorSchema = [-3, _s, "TsCompileServiceException", 0, [], []];
_s_registry.registerError(TsCompileServiceException$, TsCompileServiceException);
const n0_registry = TypeRegistry.for(n0);
const n1_registry = TypeRegistry.for(n1);
export var ValidationException$: StaticErrorSchema = [-3, n0, _VE,
  { [_e]: _c },
  [_m, _fL],
  [0, () => ValidationExceptionFieldList], 1
];
n0_registry.registerError(ValidationException$, ValidationException);
export var CompileFailed$: StaticErrorSchema = [-3, n1, _CF,
  { [_e]: _c, [_hE]: 422 },
  [_m, _t, _d, _de, _mV],
  [0, 0, () => DiagnosticList, () => DeclarationList, 64 | 0], 5
];
n1_registry.registerError(CompileFailed$, CompileFailed);
export var SourceHashMismatch$: StaticErrorSchema = [-3, n1, _SHM,
  { [_e]: _c, [_hE]: 409 },
  [_m, _i],
  [0, 0], 2
];
n1_registry.registerError(SourceHashMismatch$, SourceHashMismatch);
/**
 * TypeRegistry instances containing modeled errors.
 * @internal
 *
 */
export const errorTypeRegistries = [
  _s_registry,
  n0_registry,
  n1_registry,
]
var __Unit = "unit" as const;
export var ValidationExceptionField$: StaticStructureSchema = [3, n0, _VEF,
  0,
  [_p, _m],
  [0, 0], 2
];
export var CompileInput$: StaticStructureSchema = [3, n1, _CI,
  0,
  [_sc, _vN],
  [() => ScriptList, 64 | 0], 2
];
export var CompileOutput$: StaticStructureSchema = [3, n1, _CO,
  0,
  [_t, _hT, _sc, _ca, _de],
  [0, 0, () => ScriptList, 2, () => DeclarationList], 5
];
export var Declaration$: StaticStructureSchema = [3, n1, _D,
  0,
  [_i, _pa, _u],
  [0, () => DeclaredParamList, 2], 3
];
export var DeclaredParam$: StaticStructureSchema = [3, n1, _DP,
  0,
  [_n, _k, _r, _sch, _su],
  [0, 0, 2, () => ParamSchema$, 0], 4
];
export var Diagnostic$: StaticStructureSchema = [3, n1, _Di,
  0,
  [_co, _m, _f, _l, _col],
  [0, 0, 0, 1, 1], 2
];
export var GetHealthOutput$: StaticStructureSchema = [3, n1, _GHO,
  0,
  [_o, _t, _hT],
  [2, 0, 0], 3
];
export var ParamSchema$: StaticStructureSchema = [3, n1, _PS,
  0,
  [_ty, _mL, _mLa, _en],
  [0, 1, 1, 64 | 0], 1
];
export var Script$: StaticStructureSchema = [3, n1, _S,
  0,
  [_i, _v, _ph, _so, _sh, _op],
  [0, 1, 0, 0, 0, 15], 5
];
var ValidationExceptionFieldList: StaticListSchema = [1, n0, _VEFL,
  0, () => ValidationExceptionField$
];
var DeclarationList: StaticListSchema = [1, n1, _DL,
  0, () => Declaration$
];
var DeclaredParamList: StaticListSchema = [1, n1, _DPL,
  0, () => DeclaredParam$
];
var DiagnosticList: StaticListSchema = [1, n1, _DLi,
  0, () => Diagnostic$
];
var ParamEnum = 64 | 0;
var ScriptList: StaticListSchema = [1, n1, _SL,
  0, () => Script$
];
var ValueNameList = 64 | 0;
export var Compile$: StaticOperationSchema = [9, n1, _C,
  { [_h]: ["POST", "/compile", 200] }, () => CompileInput$, () => CompileOutput$
];
export var GetHealth$: StaticOperationSchema = [9, n1, _GH,
  { [_h]: ["GET", "/healthz", 200] }, () => __Unit, () => GetHealthOutput$
];
