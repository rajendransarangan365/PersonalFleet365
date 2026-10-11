import { Router } from 'express';
import { requireAuth, requireBusinessMembership, requirePermission } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { CreateExpenseSchema, CreateFuelEntrySchema } from '@fleetwise/shared';
import * as ExpenseController from './expenses.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireBusinessMembership);

// Expenses
router.get('/', requirePermission('expense.read'), ExpenseController.listExpenses);
router.post('/', requirePermission('expense.create'), validate(CreateExpenseSchema), ExpenseController.createExpense);
router.get('/summary', requirePermission('expense.read'), ExpenseController.getExpenseSummary);
router.get('/:expenseId', requirePermission('expense.read'), ExpenseController.getExpense);

// Fuel entries
router.get('/fuel/logs', requirePermission('expense.read'), ExpenseController.listFuelEntries);
router.post('/fuel/logs', requirePermission('expense.create'), validate(CreateFuelEntrySchema), ExpenseController.createFuelEntry);

export default router;
