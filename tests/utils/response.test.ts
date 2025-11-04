import { Response } from "express";
import {
  successResponse,
  errorResponse,
  errors,
} from "../../src/utils/response";

describe("Response Utils", () => {
  let mockResponse: Partial<Response>;
  let jsonResponse: any;

  beforeEach(() => {
    jsonResponse = null;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => {
        jsonResponse = data;
        return mockResponse as Response;
      }),
    };
  });

  describe("successResponse", () => {
    it("should send success response with data", () => {
      const data = { message: "Success", id: 123 };
      const result = successResponse(mockResponse as Response, data);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(jsonResponse).toEqual({
        success: true,
        data,
      });
      expect(result).toBe(mockResponse);
    });

    it("should send success response with custom status", () => {
      const data = { created: true };
      successResponse(mockResponse as Response, data, 201);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(jsonResponse).toEqual({
        success: true,
        data,
      });
    });

    it("should handle different data types", () => {
      successResponse(mockResponse as Response, "string data");
      expect(jsonResponse.data).toBe("string data");

      successResponse(mockResponse as Response, 123);
      expect(jsonResponse.data).toBe(123);

      successResponse(mockResponse as Response, null);
      expect(jsonResponse.data).toBeNull();

      successResponse(mockResponse as Response, undefined);
      expect(jsonResponse.data).toBeUndefined();
    });
  });

  describe("errorResponse", () => {
    it("should send error response", () => {
      const result = errorResponse(
        mockResponse as Response,
        "TEST_ERROR",
        "Test error message",
        400
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(jsonResponse).toEqual({
        success: false,
        message: "Test error message",
        error: {
          code: "TEST_ERROR",
          message: "Test error message",
        },
      });
      expect(result).toBe(mockResponse);
    });

    it("should include error details if provided", () => {
      const details = { field: "email", reason: "invalid format" };
      errorResponse(
        mockResponse as Response,
        "VALIDATION_ERROR",
        "Validation failed",
        400,
        details
      );

      expect(jsonResponse.error).toEqual({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details,
      });
    });

    it("should use default status code 400", () => {
      errorResponse(mockResponse as Response, "ERROR", "Message");

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe("errors object", () => {
    it("should have badRequest method", () => {
      errors.badRequest(mockResponse as Response, "Bad request message");

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(jsonResponse.error.code).toBe("BAD_REQUEST");
      expect(jsonResponse.error.message).toBe("Bad request message");
    });

    it("should have badRequest with details", () => {
      const details = { issues: [] };
      errors.badRequest(mockResponse as Response, "Bad request", details);

      expect(jsonResponse.error.details).toBe(details);
    });

    it("should have unauthorized method", () => {
      errors.unauthorized(mockResponse as Response, "Unauthorized message");

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(jsonResponse.error.code).toBe("UNAUTHORIZED");
      expect(jsonResponse.error.message).toBe("Unauthorized message");
    });

    it("should have forbidden method", () => {
      errors.forbidden(mockResponse as Response, "Forbidden message");

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse.error.code).toBe("FORBIDDEN");
      expect(jsonResponse.error.message).toBe("Forbidden message");
    });

    it("should have notFound method", () => {
      errors.notFound(mockResponse as Response, "Not found message");

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(jsonResponse.error.code).toBe("NOT_FOUND");
      expect(jsonResponse.error.message).toBe("Not found message");
    });

    it("should have conflict method", () => {
      errors.conflict(mockResponse as Response, "Conflict message");

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(jsonResponse.error.code).toBe("CONFLICT");
      expect(jsonResponse.error.message).toBe("Conflict message");
    });

    it("should have unsupportedMedia method", () => {
      errors.unsupportedMedia(
        mockResponse as Response,
        "Unsupported media message"
      );

      expect(mockResponse.status).toHaveBeenCalledWith(415);
      expect(jsonResponse.error.code).toBe("UNSUPPORTED_MEDIA");
      expect(jsonResponse.error.message).toBe("Unsupported media message");
    });

    it("should have tooManyRequests method", () => {
      errors.tooManyRequests(
        mockResponse as Response,
        "Too many requests message"
      );

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(jsonResponse.error.code).toBe("TOO_MANY_REQUESTS");
      expect(jsonResponse.error.message).toBe("Too many requests message");
    });

    it("should have internal method", () => {
      errors.internal(mockResponse as Response, "Internal error message");

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(jsonResponse.error.code).toBe("INTERNAL_ERROR");
      expect(jsonResponse.error.message).toBe("Internal error message");
    });

    it("should use default messages when not provided", () => {
      errors.badRequest(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Bad request");

      errors.unauthorized(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Unauthorized");

      errors.forbidden(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Forbidden");

      errors.notFound(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Not found");

      errors.conflict(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Conflict");

      errors.unsupportedMedia(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Unsupported media type");

      errors.tooManyRequests(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Too many requests");

      errors.internal(mockResponse as Response);
      expect(jsonResponse.error.message).toBe("Internal server error");
    });
  });
});
