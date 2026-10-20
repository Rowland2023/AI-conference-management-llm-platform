// modules/invoicing/presentation/InvoiceController.js
import { CreateInvoiceRequest }
  from "../validators/CreateInvoiceRequest.js";

export class InvoiceController {
  /**
   * @param {Object} dependencies
   * @param {import('../application/use_cases/CreateInvoiceUseCase.js').CreateInvoiceUseCase} dependencies.createInvoiceUseCase
   * @param {import('../application/use_cases/GetInvoiceByIdUseCase.js').GetInvoiceByIdUseCase} [dependencies.getInvoiceByIdUseCase]
   */
  constructor({ createInvoiceUseCase, getInvoiceByIdUseCase }) {
    this.createInvoiceUseCase = createInvoiceUseCase;
    this.getInvoiceByIdUseCase = getInvoiceByIdUseCase;

    // Arrow function binding ensures 'this' context remains intact when passed into Express route definitions
    this.create = this.create.bind(this);
    this.getById = this.getById.bind(this);
  }

  /**
   * POST /api/v1/invoices
   */
  async create(req, res) {
    try {
      // 1. Extract distributed tracing correlation ID if present in headers
      const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || null;

      // 2. Validate & sanitize input payload
      const dto = CreateInvoiceRequest.validate(req.body);

      // 3. Execute Application Use Case
      const invoice = await this.createInvoiceUseCase.execute({
        ...dto,
        correlationId,
      });

      // 4. Render success HTTP response
      return res.status(201).json({
        status: 'success',
        message: 'Invoice generated successfully',
        data: invoice,
      });
    } catch (error) {
      // Input Validation Errors (422)
      if (error.name === 'ValidationError') {
        return res.status(422).json({
          status: 'fail',
          message: 'Invalid request payload',
          errors: error.details,
        });
      }

      // Business Rule Violations (400/409)
      if (error.name === 'DomainRuleViolationError') {
        return res.status(400).json({
          status: 'fail',
          message: error.message,
        });
      }

      // Fallback for unexpected infrastructure or runtime crashes
      console.error('[InvoiceController.create] Unhandled Error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'An internal server error occurred while processing the invoice.',
      });
    }
  }

  /**
   * GET /api/v1/invoices/:id
   */
  async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invoice ID param is required',
        });
      }

      const invoice = await this.getInvoiceByIdUseCase.execute(id);

      if (!invoice) {
        return res.status(404).json({
          status: 'fail',
          message: `Invoice with ID ${id} was not found`,
        });
      }

      return res.status(200).json({
        status: 'success',
        data: invoice,
      });
    } catch (error) {
      console.error('[InvoiceController.getById] Unhandled Error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve invoice details.',
      });
    }
  }
}