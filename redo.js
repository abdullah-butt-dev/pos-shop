const fs = require('fs');

// 1. Dashboard
let dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
dashboard = dashboard.replace(
`          {/* Quick actions */}
          <section className="pos-panel rounded-xl p-4">
            <h2 className="font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              <QuickAction href="/orders" icon={ShoppingCart} label="New Sale" />
              <QuickAction href="/inventory" icon={Package} label="Inventory" />
              <QuickAction href="/receivables" icon={Users} label="Receivables" />
              <QuickAction href="/payables" icon={Wallet} label="Payables" />
            </div>
          </section>`,
''
);
dashboard = dashboard.replace('return <Link href={href}>{content}</Link>', 'return <Link href={href} prefetch={true}>{content}</Link>');
dashboard = dashboard.replace('<Link href={href} className="pos-panel rounded-xl p-4 hover:bg-foreground/5 transition block">', '<Link href={href} prefetch={true} className="pos-panel rounded-xl p-4 hover:bg-foreground/5 transition block">');
fs.writeFileSync('app/dashboard/page.tsx', dashboard);

// 2. Home
let home = fs.readFileSync('app/page.tsx', 'utf8');
home = home.replace(
`<Link
            href="/orders"
            className="block w-full pos-panel rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group"`,
`<Link
            href="/orders"
            prefetch={true}
            className="block w-full pos-panel rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group"`
);
home = home.replace(
`<Link
                key={card.href}
                href={card.href}
                className="pos-panel rounded-xl p-4 sm:p-5 hover:shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group"`,
`<Link
                key={card.href}
                href={card.href}
                prefetch={true}
                className="pos-panel rounded-xl p-4 sm:p-5 hover:shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group"`
);
fs.writeFileSync('app/page.tsx', home);

// 3. Payables
let payables = fs.readFileSync('app/payables/page.tsx', 'utf8');
payables = payables.replace('<th className="py-2 pr-3">Reference</th>', '');
payables = payables.replace('<td className="py-3 pr-3 whitespace-nowrap">{p.reference_number || "—"}</td>', '');
payables = payables.replace('<td colSpan={7} className="py-4 text-center text-muted-foreground text-sm">', '<td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">');
payables = payables.replace('<td colSpan={7} className="py-3">', '<td colSpan={6} className="py-3">');
payables = payables.replace('? `${pay.pos_purchases.reference_number || formatDate(pay.pos_purchases.purchase_date)}`', '? formatDate(pay.pos_purchases.purchase_date)');
fs.writeFileSync('app/payables/page.tsx', payables);

// 4. Receivables
let receivables = fs.readFileSync('app/receivables/page.tsx', 'utf8');
receivables = receivables.replace('<th className="py-2 pr-3">Notes</th>', '');
receivables = receivables.replace('<td className="py-2 pr-3 whitespace-nowrap">{s.notes || "—"}</td>', '');
receivables = receivables.replace('<td colSpan={7} className="py-3">', '<td colSpan={6} className="py-3">');
receivables = receivables.replace('<th className="py-2">Notes</th>', '');
receivables = receivables.replace('<td className="py-2 text-muted-foreground">{pay.notes || "—"}</td>', '');
fs.writeFileSync('app/receivables/page.tsx', receivables);

console.log("Files updated successfully.");
