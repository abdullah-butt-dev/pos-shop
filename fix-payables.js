const fs = require('fs');

let content = fs.readFileSync('app/payables/page.tsx', 'utf8');
content = content.replace(
  '{pay.pos_purchases\n                                    ? `${pay.pos_purchases.reference_number || formatDate(pay.pos_purchases.purchase_date)}`\n                                    ? formatDate(pay.pos_purchases.purchase_date)\n                                    : "—"}',
  '{pay.pos_purchases ? formatDate(pay.pos_purchases.purchase_date) : "—"}'
);
content = content.replace(
  '                              <td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">\n                                No {purchaseTab} purchases found.\n                              </td>',
  ''
);
content = content.replace(
  '                              <td colSpan={7} className="py-4 text-center text-muted-foreground text-sm">',
  '                              <td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">'
);

content = content.replace(
  '                                      <td colSpan={7} className="py-3">',
  '                                      <td colSpan={6} className="py-3">'
);
content = content.replace(
  '                                      <td colSpan={6} className="py-3">\n                                        <form',
  '                                        <form'
);

fs.writeFileSync('app/payables/page.tsx', content);
