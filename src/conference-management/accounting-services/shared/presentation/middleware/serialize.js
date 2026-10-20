export const serialize = (Serializer) => (req, res, next) => {
    try {
        if (!Serializer || typeof Serializer.serialize !== "function") {
            throw new TypeError(
                "serialize middleware requires a serializer with a serialize(req) method"
            );
        }

        req.command = Serializer.serialize(req);

        next();
    } catch (error) {
        next(error);
    }
};
