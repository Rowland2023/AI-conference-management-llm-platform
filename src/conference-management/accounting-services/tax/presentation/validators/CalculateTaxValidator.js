// tax/presentation/validators/CalculateTaxValidator.js

import { z }
    from "zod";

import { TaxType }
    from "../../domain/value-objects/TaxType.js";


const taxTypes =
    Object.values(TaxType);


export const calculateTaxSchema =

    z.object({

        transactionId:

            z.string().uuid(),

        taxpayerId:

            z.string().uuid(),

        taxType:

            z.enum(taxTypes),

        taxableAmount:

            z.number()
                .positive(),

        rate:

            z.number()
                .min(0)
                .max(1),

        currency:

            z.string()
                .length(3),

    });