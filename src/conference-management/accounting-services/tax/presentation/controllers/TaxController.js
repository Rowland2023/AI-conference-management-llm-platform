// tax/presentation/controllers/TaxController.js

export class TaxController {

    constructor({

        taxService,

    }) {

        this.taxService =
            taxService;

    }


    async calculate(req, res, next) {

        try {

            const result =
                await this.taxService.calculate(

                    req.body,

                );

            res.status(201).json(result);

        }

        catch (error) {

            next(error);

        }

    }


    async record(req, res, next) {

        try {

            const result =
                await this.taxService.record({

                    taxId:
                        req.params.taxId,

                });

            res.json(result);

        }

        catch (error) {

            next(error);

        }

    }


    async pay(req, res, next) {

        try {

            const result =
                await this.taxService.pay({

                    taxId:
                        req.params.taxId,

                    ...req.body,

                });

            res.json(result);

        }

        catch (error) {

            next(error);

        }

    }


    async get(req, res, next) {

        try {

            const result =
                await this.taxService.get({

                    taxId:
                        req.params.taxId,

                });

            res.json(result);

        }

        catch (error) {

            next(error);

        }

    }


    async list(req, res, next) {

        try {

            const result =
                await this.taxService.list(

                    req.query,

                );

            res.json(result);

        }

        catch (error) {

            next(error);

        }

    }

}