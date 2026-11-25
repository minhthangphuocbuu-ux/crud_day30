const productRepository = require("../repository/product");
const sendJson = require("../utils/sendJson");

const FILTER_FIELDS = new Set(["id", "name", "price", "category", "stock"]);
const NUMERIC_FIELDS = new Set(["id", "price", "stock"]);
const FILTER_OPERATORS = {
    eq: "$eq",
    gt: "$gt",
    gte: "$gte",
    lt: "$lt",
    lte: "$lte",
    ne: "$ne",
    in: "$in",
    exists: "$exists",
    type: "$type"
};
const BSON_TYPES = new Map([
    "double", "string", "object", "array", "binData", "undefined", "objectId",
    "bool", "date", "null", "regex", "javascript", "int", "timestamp", "long",
    "decimal", "minKey", "maxKey", "number"
].map(type => [type.toLowerCase(), type]));
const SORT_FIELDS = new Set(["id", "name", "price", "category", "stock"]);

function invalid(message) {
    return { error: message };
}

function parseInteger(value, name, defaultValue, maximum) {
    if (value === null) return { value: defaultValue };
    if (!/^\d+$/.test(value)) return invalid(`Invalid ${name}`);

    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
        return invalid(`Invalid ${name}`);
    }
    return { value: number };
}

function parseFilter(query) {
    const filter = {};

    for (const [key, rawValue] of query.entries()) {
        if (["page", "limit", "sort", "order"].includes(key)) continue;

        const match = /^filter\[([a-zA-Z]+)\](?:\[([a-zA-Z$]+)\])?$/.exec(key);
        if (!match) return invalid(`Invalid query parameter: ${key}`);

        const [, field, rawOperator] = match;
        if (!FILTER_FIELDS.has(field)) return invalid(`Filtering by ${field} is not allowed`);

        const operatorName = (rawOperator || "eq").replace(/^\$/, "").toLowerCase();
        const mongoOperator = FILTER_OPERATORS[operatorName];
        if (!mongoOperator) return invalid(`Invalid filter operator: ${rawOperator}`);

        let value;
        if (operatorName === "exists") {
            if (rawValue !== "true" && rawValue !== "false") {
                return invalid(`filter[${field}][exists] must be true or false`);
            }
            value = rawValue === "true";
        } else if (operatorName === "type") {
            value = BSON_TYPES.get(rawValue.toLowerCase());
            if (!value) return invalid(`Invalid BSON type: ${rawValue}`);
        } else {
            const values = operatorName === "in" ? rawValue.split(",") : [rawValue];
            if (values.some(item => item.length === 0)) return invalid(`Invalid filter value for ${field}`);

            if (["gt", "gte", "lt", "lte"].includes(operatorName) && !NUMERIC_FIELDS.has(field)) {
                return invalid(`${operatorName} requires a numeric field`);
            }

            const parsedValues = [];
            for (const item of values) {
                if (NUMERIC_FIELDS.has(field)) {
                    const number = Number(item);
                    if (!Number.isFinite(number)) return invalid(`filter value for ${field} must be a number`);
                    parsedValues.push(number);
                } else {
                    parsedValues.push(item);
                }
            }
            value = operatorName === "in" ? parsedValues : parsedValues[0];
        }

        if (mongoOperator === "$eq") {
            if (Object.hasOwn(filter, field)) return invalid(`Conflicting filters for ${field}`);
            filter[field] = value;
            continue;
        }

        if (!Object.hasOwn(filter, field)) filter[field] = {};
        if (typeof filter[field] !== "object" || Object.hasOwn(filter[field], mongoOperator)) {
            return invalid(`Conflicting filters for ${field}`);
        }
        filter[field][mongoOperator] = value;
    }

    return { value: filter };
}

function validateObjectBody(body) {
    return body !== null && typeof body === "object" && !Array.isArray(body);
}

function validateText(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
        return `${field} must be a non-empty string`;
    }
    return null;
}

function validateNumber(value, field, { integer = false } = {}) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
        return `${field} must be a ${integer ? "non-negative integer" : "non-negative number"}`;
    }
    return null;
}

function validateCreateBody(body) {
    if (!validateObjectBody(body)) return invalid("Body must be a JSON object");

    const allowed = new Set(["name", "category", "price", "stock", "cost"]);
    const unexpected = Object.keys(body).find(field => !allowed.has(field));
    if (unexpected) return invalid(`Field ${unexpected} is not allowed`);

    for (const field of ["name", "category"]) {
        const error = validateText(body[field], field);
        if (error) return invalid(error);
    }
    const priceError = validateNumber(body.price, "price", { integer: true });
    if (priceError) return invalid(priceError);
    if (body.price > 2147483647) return invalid("price must not exceed 2147483647");

    for (const field of ["cost", "stock"]) {
        if (body[field] === undefined) continue;
        const error = validateNumber(body[field], field, { integer: true });
        if (error) return invalid(error);
        if (body[field] > 2147483647) return invalid(`${field} must not exceed 2147483647`);
    }

    return {
        value: {
            name: body.name.trim(),
            category: body.category.trim(),
            price: body.price,
            stock: body.stock ?? 0,
            cost: body.cost ?? 0
        }
    };
}

function validatePutBody(body) {
    if (!validateObjectBody(body)) return invalid("Body must be a JSON object");
    const allowed = new Set(["name", "category", "price"]);
    const unexpected = Object.keys(body).find(field => !allowed.has(field));
    if (unexpected) return invalid(`Field ${unexpected} is not allowed`);

    for (const field of ["name", "category"]) {
        const error = validateText(body[field], field);
        if (error) return invalid(error);
    }
    const priceError = validateNumber(body.price, "price", { integer: true });
    if (priceError) return invalid(priceError);
    if (body.price > 2147483647) return invalid("price must not exceed 2147483647");

    return {
        value: {
            name: body.name.trim(),
            category: body.category.trim(),
            price: body.price
        }
    };
}

function validatePatchBody(body) {
    if (!validateObjectBody(body)) return invalid("Body must be a JSON object");
    const fields = Object.keys(body);
    if (fields.length === 0) return invalid("Body must contain at least one field");

    const allowed = new Set(["name", "category", "price", "cost"]);
    const unexpected = fields.find(field => !allowed.has(field));
    if (unexpected) return invalid(`Field ${unexpected} cannot be changed with this route`);

    for (const field of fields) {
        const error = field === "name" || field === "category"
            ? validateText(body[field], field)
            : validateNumber(body[field], field, { integer: true });
        if (error) return invalid(error);
        if (body[field] > 2147483647) return invalid(`${field} must not exceed 2147483647`);
    }

    const value = { ...body };
    for (const field of ["name", "category"]) {
        if (Object.hasOwn(value, field)) value[field] = value[field].trim();
    }
    return { value };
}

function parseProductId(rawId) {
    const id = Number(rawId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getAll(req, res) {
    const limit = parseInteger(req.query.get("limit"), "limit", null, Number.MAX_SAFE_INTEGER);
    if (limit.error) return sendJson(res, 400, { message: limit.error });
    const page = parseInteger(req.query.get("page"), "page", 1, Number.MAX_SAFE_INTEGER);
    if (page.error) return sendJson(res, 400, { message: page.error });
    if (req.query.has("page") && limit.value === null) {
        return sendJson(res, 400, { message: "limit is required when page is specified" });
    }
    if (limit.value !== null && !Number.isSafeInteger((page.value - 1) * limit.value)) {
        return sendJson(res, 400, { message: "Invalid page" });
    }

    const sort = req.query.get("sort") || "id";
    if (!SORT_FIELDS.has(sort)) return sendJson(res, 400, { message: "Invalid sort field" });

    const orderName = req.query.get("order") || "asc";
    if (orderName !== "asc" && orderName !== "desc") {
        return sendJson(res, 400, { message: "order must be asc or desc" });
    }

    const parsedFilter = parseFilter(req.query);
    if (parsedFilter.error) return sendJson(res, 400, { message: parsedFilter.error });

    const result = await productRepository.findAll({
        filter: parsedFilter.value,
        page: page.value,
        limit: limit.value === null ? undefined : limit.value,
        sort,
        order: orderName === "asc" ? 1 : -1
    });
    return sendJson(res, 200, result);
}

async function getById(req, res) {
    const id = parseProductId(req.params.id);
    if (id === null) return sendJson(res, 404, { message: "Product not found" });

    const product = await productRepository.findById(id);
    if (!product) return sendJson(res, 404, { message: "Product not found" });
    return sendJson(res, 200, product);
}

async function create(req, res) {
    const validated = validateCreateBody(req.body);
    if (validated.error) return sendJson(res, 400, { message: validated.error });

    const product = await productRepository.create(validated.value);
    return sendJson(res, 201, product);
}

async function update(req, res) {
    const id = parseProductId(req.params.id);
    if (id === null) return sendJson(res, 404, { message: "Product not found" });

    const validated = validatePutBody(req.body);
    if (validated.error) return sendJson(res, 400, { message: validated.error });

    const product = await productRepository.update(id, validated.value);
    if (!product) return sendJson(res, 404, { message: "Product not found" });
    return sendJson(res, 200, product);
}

async function patch(req, res) {
    const id = parseProductId(req.params.id);
    if (id === null) return sendJson(res, 404, { message: "Product not found" });

    const validated = validatePatchBody(req.body);
    if (validated.error) return sendJson(res, 400, { message: validated.error });

    const product = await productRepository.patch(id, validated.value);
    if (!product) return sendJson(res, 404, { message: "Product not found" });
    return sendJson(res, 200, product);
}

async function changeStock(req, res) {
    const id = parseProductId(req.params.id);
    if (id === null) return sendJson(res, 404, { message: "Product not found" });
    if (!validateObjectBody(req.body)) return sendJson(res, 400, { message: "Body must be a JSON object" });

    const { change } = req.body;
    if (typeof change !== "number" || !Number.isSafeInteger(change) || change === 0) {
        return sendJson(res, 400, { message: "change must be a non-zero integer" });
    }

    const product = await productRepository.changeStock(id, change);
    if (!product) return sendJson(res, 404, { message: "Product not found" });
    if (product.insufficientStock) {
        return sendJson(res, 409, { message: "Insufficient stock" });
    }
    return sendJson(res, 200, product);
}

async function remove(req, res) {
    const id = parseProductId(req.params.id);
    if (id === null) return sendJson(res, 404, { message: "Product not found" });

    const product = await productRepository.softDelete(id);
    if (!product) return sendJson(res, 404, { message: "Product not found" });
    res.statusCode = 204;
    return res.end();
}

module.exports = { getAll, getById, create, update, patch, changeStock, remove };
