import { beforeEach, afterEach, describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { OPERATION_REQUEST_STATUS } from '../../../src/constants/constants.js';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import OperationIdServiceMock from '../mock/operation-id-service-mock.js';
import CommandExecutorMock from '../mock/command-executor-mock.js';
import PublishService from '../../../src/service/publish-service.js';
import Logger from '../../../src/logger/logger.js';

let publishService;
let cacheOperationIdDataSpy;
let commandExecutorAddSpy;

describe('Publish service test', async () => {
    beforeEach(() => {
        const repositoryModuleManagerMock = new RepositoryModuleManagerMock();

        publishService = new PublishService({
            repositoryModuleManager: repositoryModuleManagerMock,
            operationIdService: new OperationIdServiceMock({
                repositoryModuleManager: repositoryModuleManagerMock,
            }),
            commandExecutor: new CommandExecutorMock(),
            validationModuleManager: new ValidationModuleManagerMock(),
            blockchainModuleManager: new BlockchainModuleManagerMock(),
            logger: new Logger(),
        });
        cacheOperationIdDataSpy = sinon.spy(
            publishService.operationIdService,
            'cacheOperationIdData',
        );
        commandExecutorAddSpy = sinon.spy(publishService.commandExecutor, 'add');
    });

    afterEach(() => {
        cacheOperationIdDataSpy.restore();
        commandExecutorAddSpy.restore();
    });

    it('Completed publish completes with low ACK ask', async () => {
        await publishService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 1,
                },
            },
            OPERATION_REQUEST_STATUS.COMPLETED,
            {},
        );

        const returnedResponses = publishService.repositoryModuleManager.getAllResponseStatuses();

        expect(cacheOperationIdDataSpy.calledWith('5195d01a-b437-4aae-b388-a77b9fa715f1', {})).to.be
            .false;

        expect(returnedResponses.length).to.be.equal(2);

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    });

    it('Completed publish fails with high ACK ask', async () => {
        await publishService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 12,
                },
            },
            OPERATION_REQUEST_STATUS.COMPLETED,
            {},
        );

        const returnedResponses = publishService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.FAILED,
        ).to.be.true;
    });

    it('Failed publish fails with low ACK ask', async () => {
        await publishService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 1,
                },
            },
            OPERATION_REQUEST_STATUS.FAILED,
            {},
        );

        const returnedResponses = publishService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.FAILED,
        ).to.be.true;
    });

    it('Completed publish leads to scheduling operation for leftover nodes and status stays same', async () => {
        await publishService.processResponse(
            {
                data: {
                    operationId: '5195d01a-b437-4aae-b388-a77b9fa715f1',
                    numberOfFoundNodes: 1,
                    leftoverNodes: [1, 2, 3, 4],
                    keyword: 'origintrail',
                    batchSize: 10,
                    minAckResponses: 12,
                },
            },
            OPERATION_REQUEST_STATUS.COMPLETED,
            {},
        );

        const returnedResponses = publishService.repositoryModuleManager.getAllResponseStatuses();

        expect(returnedResponses.length).to.be.equal(2);

        expect(
            commandExecutorAddSpy.calledWith('5195d01a-b437-4aae-b388-a77b9fa715f1', [1, 2, 3, 4]),
        );

        expect(
            returnedResponses[returnedResponses.length - 1].status ===
                OPERATION_REQUEST_STATUS.COMPLETED,
        ).to.be.true;
    });
});
