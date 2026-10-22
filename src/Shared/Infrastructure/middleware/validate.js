
import { ValidationError } from "../../application/errors/ApplicationErrors.js";

/**
 * Validate HTTP request input against a Zod or Joi schema.
 *
 * Supports wrapped schemas:
 *   z.object({ body: z.object({ ... }) })
 *
 * And direct schemas:
 *   z.object({ ... })
 *
 * @param {object} schema - Zod or Joi schema.
 * @param {"body" | "query" | "params"} property - Request property to validate.
 * @returns {import("express").RequestHandler}
 */
export const validate = (schema, property = "body") => {
    if (!isZodSchema(schema) && !isJoiSchema(schema)) {
        throw new ValidationError("Unsupported validation schema");
    }

    return (req, res, next) => {
    try {
        const input = req[property] ?? {};
        const result = parseRequest(schema, property, input);

        // Keep validated values separately, including Express 5 query values.
        req.validated ??= {};
        req.validated[property] = result;

        // Express 5 exposes req.query through a getter.
        if (property !== "query") {
            req[property] = result;
        }

        next();
    } catch (error) {
        next(error);
    }
};
};

function parseRequest(schema, property, input) {
    if (isZodSchema(schema)) {
        const wrapped = schema.shape &&
            Object.hasOwn(schema.shape, property);

        const result = schema.safeParse(
            wrapped ? { [property]: input } : input
        );

        if (!result.success) {
            throw new ValidationError(formatZodError(result.error));
        }

        return wrapped ? result.data[property] : result.data;
    }

    const result = schema.validate(input, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (result.error) {
        throw new ValidationError(formatJoiError(result.error));
    }

    return result.value;
}

function isZodSchema(schema) {
    return typeof schema?.safeParse === "function";
}

function isJoiSchema(schema) {
    return typeof schema?.validate === "function";
}

function formatZodError(error) {
    return (error.issues ?? error.errors ?? [])
        .map(({ path, message }) =>
            `${path?.length ? path.join(".") : "request"}: ${message}`
        )
        .join(", ");
}

function formatJoiError(error) {
    return (error.details ?? [])
        .map(({ message }) => message)
        .join(", ");
}
