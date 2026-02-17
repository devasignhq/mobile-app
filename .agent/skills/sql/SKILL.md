name: SQL
description: A comprehensive guide and skill for writing efficient, secure, and maintainable SQL queries.
global: true
---

# SQL Skill

This skill provides guidelines and best practices for working with SQL databases. Since this project currently does not have a specific database configured, these instructions serve as a general reference for when a database is added.

## 1. Best Practices

### detailed-selects
Avoid using `SELECT *`. Always specify the columns you need to retrieve. This reduces network load and improves query performance.
```sql
-- Bad
SELECT * FROM users;

-- Good
SELECT id, username, email FROM users;
```

### parameterized-queries
Never concatenate user input directly into SQL queries to prevent SQL injection attacks. Use parameterized queries or prepared statements.
```sql
-- Bad (Vulnerable to SQL Injection)
const query = `SELECT * FROM users WHERE id = ${userId}`;

-- Good (Safe)
const query = 'SELECT * FROM users WHERE id = ?';
db.execute(query, [userId]);
```

### indexing
Ensure that columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses are properly indexed. However, avoid over-indexing as it can slow down `INSERT` and `UPDATE` operations.

### transactions
Use transactions for operations that modify multiple tables or rows to ensure data integrity.
```sql
BEGIN TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

## 2. Common Operations

### joins
Use `INNER JOIN` for matching rows in both tables, and `LEFT JOIN` when you want all rows from the left table even if there are no matches in the right table.
```sql
SELECT u.username, p.title
FROM users u
INNER JOIN posts p ON u.id = p.user_id;
```

### aggregation
Use `GROUP BY` with aggregate functions like `COUNT`, `SUM`, `AVG`.
```sql
SELECT department, COUNT(*) as employee_count
FROM employees
GROUP BY department;
```

### subqueries-and-ctes
Common Table Expressions (CTEs) are often more readable than complex subqueries.
```sql
WITH regional_sales AS (
    SELECT region, SUM(amount) as total_sales
    FROM orders
    GROUP BY region
)
SELECT region
FROM regional_sales
WHERE total_sales > (SELECT AVG(total_sales) FROM regional_sales);
```

## 3. Database Design Tips

- **Normalization**: Organize data to reduce redundancy (e.g., 3NF).
- **Foreign Keys**: Enforce referential integrity.
- **Data Types**: Choose the smallest appropriate data type for columns (e.g., `VARCHAR(255)` vs `TEXT`, `INT` vs `BIGINT`).

## 4. Project Integration

When a database is added to this project (e.g., PostgreSQL with Prisma, SQLite, etc.), update this skill with:
- Connection details (referencing environment variables).
- Schema diagrams or descriptions.
- Common project-specific queries.

## 5. Troubleshooting Performance

- **EXPLAIN**: Use `EXPLAIN` (or `EXPLAIN ANALYZE`) to understand query execution plans.
- **Slow Logs**: Monitor database slow query logs to identify bottlenecks.
- **N+1 Problem**: Watch out for N+1 query patterns in application code (loading related data in a loop).
