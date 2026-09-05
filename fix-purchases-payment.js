const fs = require('fs');
let content = fs.readFileSync('app/purchases/page.tsx', 'utf8');

const replacement = `
    const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    let finalAmountPaid = 0;
    if (paymentMethod === "Paid") {
      finalAmountPaid = totalCost;
    } else if (paymentMethod === "Partial") {
      finalAmountPaid = Number(amountPaid) || 0;
    }

    setSubmitting(true);
    try {
      const result = await PosPurchaseService.create({
        supplier_id: supplier.id,
        purchase_date: purchaseDate,
        items,
        amount_paid: finalAmountPaid,
        payment_method: paymentMethod.trim() || undefined,
      });
`;

content = content.replace(
`    setSubmitting(true);
    try {
      const result = await PosPurchaseService.create({
        supplier_id: supplier.id,
        purchase_date: purchaseDate,
        items,
        amount_paid: Number(amountPaid) || 0,
        payment_method: paymentMethod.trim() || undefined,
      });`,
replacement);

fs.writeFileSync('app/purchases/page.tsx', content);
