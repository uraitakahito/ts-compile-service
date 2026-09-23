// smithy-typescript generated code
import {
  loadRestJsonErrorCode,
  parseJsonBody as parseBody,
  parseJsonErrorBody as parseErrorBody,
} from "@aws-sdk/core/protocols";
import { _json, isSerializableHeaderValue, map, take } from "@smithy/core/client";
import { collectBody, HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/core/protocols";
import {
  calculateBodyLength,
  expectInt32 as __expectInt32,
  expectNonNull as __expectNonNull,
  expectObject as __expectObject,
  expectString as __expectString,
} from "@smithy/core/serde";
import {
  acceptMatches as __acceptMatches,
  NotAcceptableException as __NotAcceptableException,
  ServerSerdeContext,
  ServiceException as __BaseException,
  SmithyFrameworkException as __SmithyFrameworkException,
  UnsupportedMediaTypeException as __UnsupportedMediaTypeException,
} from "@smithy/server-common";
import {
  type Endpoint as __Endpoint,
  type ResponseMetadata as __ResponseMetadata,
  type SerdeContext as __SerdeContext,
  DocumentType as __DocumentType,
} from "@smithy/types";

import { CompileFailed, SourceHashMismatch, ValidationException } from "../models/errors";
import { Diagnostic, Script, ValidationExceptionField } from "../models/models_0";
import { CompileServerInput, CompileServerOutput } from "../server/operations/Compile";
import { GetHealthServerInput, GetHealthServerOutput } from "../server/operations/GetHealth";

export const deserializeCompileRequest = async (
  output: __HttpRequest,
  context: __SerdeContext
): Promise<CompileServerInput> => {
  const contentTypeHeaderKey: string | undefined = Object.keys(output.headers).find(key => key.toLowerCase() === 'content-type');
  if (contentTypeHeaderKey != null) {
    const contentType = output.headers[contentTypeHeaderKey];
    if (contentType !== undefined && contentType !== "application/json") {
      throw new __UnsupportedMediaTypeException();
    };
  };
  const acceptHeaderKey: string | undefined = Object.keys(output.headers).find(key => key.toLowerCase() === 'accept');
  if (acceptHeaderKey != null) {
    const accept = output.headers[acceptHeaderKey];
    if (!__acceptMatches(accept, "application/json")) {
      throw new __NotAcceptableException();
    };
  };
  const contents: any = map({
  });
  const data: Record<string, any> = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
  const doc = take(data, {
    'scripts': _ => de_ScriptList(_, context),
  });
  Object.assign(contents, doc);
  return contents;
};

export const deserializeGetHealthRequest = async (
  output: __HttpRequest,
  context: __SerdeContext
): Promise<GetHealthServerInput> => {
  const contentTypeHeaderKey: string | undefined = Object.keys(output.headers).find(key => key.toLowerCase() === 'content-type');
  if (contentTypeHeaderKey != null) {
    const contentType = output.headers[contentTypeHeaderKey];
    if (contentType !== undefined) {
      throw new __UnsupportedMediaTypeException();
    };
  };
  const acceptHeaderKey: string | undefined = Object.keys(output.headers).find(key => key.toLowerCase() === 'accept');
  if (acceptHeaderKey != null) {
    const accept = output.headers[acceptHeaderKey];
    if (!__acceptMatches(accept, "application/json")) {
      throw new __NotAcceptableException();
    };
  };
  const contents: any = map({
  });
  await collectBody(output.body, context);
  return contents;
};

export const serializeCompileResponse = async (
  input: CompileServerOutput,
  ctx: ServerSerdeContext
): Promise<__HttpResponse> => {
  const context: __SerdeContext = {
    ...ctx,
    endpoint: () => Promise.resolve({
      protocol: '',
      hostname: '',
      path: '',
    }),
  };
  let statusCode: number = 200
  let headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
  });
  let body: any;
  body = JSON.stringify(take(input, {
    'cached': [],
    'scripts': _ => se_ScriptList(_, context),
    'typescript': [],
  }));
  if (body && Object.keys(headers).map((str) => str.toLowerCase()).indexOf('content-length') === -1) {
    const length = calculateBodyLength(body);
    if (length !== undefined) {
      headers = { ...headers, 'content-length': String(length) };
    }
  }
  return new __HttpResponse({
    headers,
    body,
    statusCode,
  });
};

export const serializeGetHealthResponse = async (
  input: GetHealthServerOutput,
  ctx: ServerSerdeContext
): Promise<__HttpResponse> => {
  const context: __SerdeContext = {
    ...ctx,
    endpoint: () => Promise.resolve({
      protocol: '',
      hostname: '',
      path: '',
    }),
  };
  let statusCode: number = 200
  let headers: any = map({}, isSerializableHeaderValue, {
    'content-type': 'application/json',
  });
  let body: any;
  body = JSON.stringify(take(input, {
    'hostTypes': [],
    'ok': [],
    'typescript': [],
  }));
  if (body && Object.keys(headers).map((str) => str.toLowerCase()).indexOf('content-length') === -1) {
    const length = calculateBodyLength(body);
    if (length !== undefined) {
      headers = { ...headers, 'content-length': String(length) };
    }
  }
  return new __HttpResponse({
    headers,
    body,
    statusCode,
  });
};

export const serializeFrameworkException = async (
  input: __SmithyFrameworkException,
  ctx: ServerSerdeContext
): Promise<__HttpResponse> => {
  const context: __SerdeContext = {
    ...ctx,
    endpoint: () => Promise.resolve({
      protocol: '',
      hostname: '',
      path: '',
    }),
  };
  switch (input.name) {
    case "InternalFailure": {
      const statusCode: number = 500
      let headers: any = map({}, isSerializableHeaderValue, {
        'x-amzn-errortype': "InternalFailure",
        'content-type': 'application/json',
      });
      let body: any;
      body = "{}";
      return new __HttpResponse({
        headers,
        body,
        statusCode,
      });
    }
    case "NotAcceptableException": {
      const statusCode: number = 406
      let headers: any = map({}, isSerializableHeaderValue, {
        'x-amzn-errortype': "NotAcceptableException",
        'content-type': 'application/json',
      });
      let body: any;
      body = "{}";
      return new __HttpResponse({
        headers,
        body,
        statusCode,
      });
    }
    case "SerializationException": {
      const statusCode: number = 400
      let headers: any = map({}, isSerializableHeaderValue, {
        'x-amzn-errortype': "SerializationException",
        'content-type': 'application/json',
      });
      let body: any;
      body = "{}";
      return new __HttpResponse({
        headers,
        body,
        statusCode,
      });
    }
    case "UnauthenticatedException": {
      const statusCode: number = 401
      let headers: any = map({}, isSerializableHeaderValue, {
        'x-amzn-errortype': "UnauthenticatedException",
        'content-type': 'application/json',
      });
      let body: any;
      body = "{}";
      return new __HttpResponse({
        headers,
        body,
        statusCode,
      });
    }
    case "UnknownOperationException": {
      const statusCode: number = 404
      let headers: any = map({}, isSerializableHeaderValue, {
        'x-amzn-errortype': "UnknownOperationException",
        'content-type': 'application/json',
      });
      let body: any;
      body = "{}";
      return new __HttpResponse({
        headers,
        body,
        statusCode,
      });
    }
    case "UnsupportedMediaTypeException": {
      const statusCode: number = 415
      let headers: any = map({}, isSerializableHeaderValue, {
        'x-amzn-errortype': "UnsupportedMediaTypeException",
        'content-type': 'application/json',
      });
      let body: any;
      body = "{}";
      return new __HttpResponse({
        headers,
        body,
        statusCode,
      });
    }
  }
}

export const serializeValidationExceptionError = async (
  input: ValidationException,
  ctx: ServerSerdeContext
): Promise<__HttpResponse> => {
  const context: __SerdeContext = {
    ...ctx,
    endpoint: () => Promise.resolve({
      protocol: '',
      hostname: '',
      path: '',
    }),
  };
  const statusCode: number = 400
  let headers: any = map({}, isSerializableHeaderValue, {
    'x-amzn-errortype': "ValidationException",
    'content-type': 'application/json',
  });
  let body: any;
  body = JSON.stringify(take(input, {
    'fieldList': _ => se_ValidationExceptionFieldList(_, context),
    'message': [],
  }));
  return new __HttpResponse({
    headers,
    body,
    statusCode,
  });
};

export const serializeCompileFailedError = async (
  input: CompileFailed,
  ctx: ServerSerdeContext
): Promise<__HttpResponse> => {
  const context: __SerdeContext = {
    ...ctx,
    endpoint: () => Promise.resolve({
      protocol: '',
      hostname: '',
      path: '',
    }),
  };
  const statusCode: number = 422
  let headers: any = map({}, isSerializableHeaderValue, {
    'x-amzn-errortype': "CompileFailed",
    'content-type': 'application/json',
  });
  let body: any;
  body = JSON.stringify(take(input, {
    'diagnostics': _ => se_DiagnosticList(_, context),
    'message': [],
    'typescript': [],
  }));
  return new __HttpResponse({
    headers,
    body,
    statusCode,
  });
};

export const serializeSourceHashMismatchError = async (
  input: SourceHashMismatch,
  ctx: ServerSerdeContext
): Promise<__HttpResponse> => {
  const context: __SerdeContext = {
    ...ctx,
    endpoint: () => Promise.resolve({
      protocol: '',
      hostname: '',
      path: '',
    }),
  };
  const statusCode: number = 409
  let headers: any = map({}, isSerializableHeaderValue, {
    'x-amzn-errortype': "SourceHashMismatch",
    'content-type': 'application/json',
  });
  let body: any;
  body = JSON.stringify(take(input, {
    'id': [],
    'message': [],
  }));
  return new __HttpResponse({
    headers,
    body,
    statusCode,
  });
};

/**
 * serializeAws_restJson1Document
 */
const se_Document = (
  input: __DocumentType,
  context: __SerdeContext
): any => {
  return input;
}

/**
 * serializeAws_restJson1ValidationExceptionField
 */
const se_ValidationExceptionField = (
  input: ValidationExceptionField,
  context: __SerdeContext
): any => {
  return take(input, {
    'message': [],
    'path': [],
  });
}

/**
 * serializeAws_restJson1ValidationExceptionFieldList
 */
const se_ValidationExceptionFieldList = (
  input: ValidationExceptionField[],
  context: __SerdeContext
): any => {
  return input.filter((e: any) => e != null).map(entry => {
    return se_ValidationExceptionField(entry, context);
  });
}

/**
 * serializeAws_restJson1Diagnostic
 */
const se_Diagnostic = (
  input: Diagnostic,
  context: __SerdeContext
): any => {
  return take(input, {
    'code': [],
    'col': [],
    'file': [],
    'line': [],
    'message': [],
  });
}

/**
 * serializeAws_restJson1DiagnosticList
 */
const se_DiagnosticList = (
  input: Diagnostic[],
  context: __SerdeContext
): any => {
  return input.filter((e: any) => e != null).map(entry => {
    return se_Diagnostic(entry, context);
  });
}

/**
 * serializeAws_restJson1Script
 */
const se_Script = (
  input: Script,
  context: __SerdeContext
): any => {
  return take(input, {
    'id': [],
    'options': _ => se_Document(_, context),
    'phase': [],
    'sha256': [],
    'source': [],
    'version': [],
  });
}

/**
 * serializeAws_restJson1ScriptList
 */
const se_ScriptList = (
  input: Script[],
  context: __SerdeContext
): any => {
  return input.filter((e: any) => e != null).map(entry => {
    return se_Script(entry, context);
  });
}

/**
 * deserializeAws_restJson1Document
 */
const de_Document = (
  output: any,
  context: __SerdeContext
): __DocumentType => {
  return output;
}

/**
 * deserializeAws_restJson1Script
 */
const de_Script = (
  output: any,
  context: __SerdeContext
): Script => {
  return take(output, {
    'id': __expectString,
    'options': (_: any) => de_Document(_, context),
    'phase': __expectString,
    'sha256': __expectString,
    'source': __expectString,
    'version': __expectInt32,
  }) as any;
}

/**
 * deserializeAws_restJson1ScriptList
 */
const de_ScriptList = (
  output: any,
  context: __SerdeContext
): Script[] => {
  const retVal = (output || []).map((entry: any) => {
    if (entry === null) {
      throw new TypeError('All elements of the non-sparse list "ts.compile#ScriptList" must be non-null.');
    }
    return de_Script(entry, context);
  });
  return retVal;
}

const deserializeMetadata = (output: __HttpResponse): __ResponseMetadata => ({
  httpStatusCode: output.statusCode,
  requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
  extendedRequestId: output.headers["x-amz-id-2"],
  cfId: output.headers["x-amz-cf-id"],
});

// Encode Uint8Array data into string with utf-8.
const collectBodyString = (streamBody: any, context: __SerdeContext): Promise<string> => collectBody(streamBody, context).then(body => context.utf8Encoder(body))
