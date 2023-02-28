import BaseController from './base-http-api-controller.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
} from '../../constants/constants.js';

class UpdateController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handleUpdateRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.UPDATE.UPDATE_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.UPDATE_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.UPDATE.UPDATE_INIT_END,
        );

        const { assertionData, blockchain, contract, tokenId } = req.body;
        const hashFunctionId =
            req.body.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID;
        try {
            await this.repositoryModuleManager.createOperationRecord(
                this.operationService.getOperationName(),
                operationId,
                OPERATION_STATUS.IN_PROGRESS,
            );

            this.logger.info(
                `Received asset with assertion id: ${assertionData.publicAssertionId}, blockchain: ${blockchain}, hub contract: ${contract}, token id: ${tokenId}`,
            );

            let commandSequence = [];

            if (req.body.localStore) {
                commandSequence.push('localStoreCommand');
                await this.operationIdService.cacheOperationIdData(operationId, [...assertionData]);
            } else {
                await this.operationIdService.cacheOperationIdData(operationId, {
                    ...assertionData,
                });
            }

            commandSequence = [
                ...commandSequence,
                'validateUpdateAssertionCommand',
                'networkUpdateCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                period: 5000,
                retries: 3,
                data: {
                    blockchain,
                    contract,
                    tokenId,
                    assertionId: assertionData.publicAssertionId,
                    hashFunctionId,
                    operationId,
                },
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing update data: ${error.message}. ${error.stack}`,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                'Unable to update data, Failed to process input data!',
                ERROR_TYPE.UPDATE.UPDATE_ROUTE_ERROR,
            );
        }
    }
}

export default UpdateController;
