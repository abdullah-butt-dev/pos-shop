const fs = require('fs');

function fixOrderSummary() {
  const file = 'components/pos/order-summary.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('    <aside className="pos-panel w-96 shrink-0 p-4 flex flex-col gap-4 h-full">\n    <div', '    <div');
  // ensure we close the div instead of aside at the end of the component
  content = content.replace('    </aside>\n  )\n}\n', '    </div>\n  )\n}\n');
  fs.writeFileSync(file, content);
}

function fixDashboard() {
  const file = 'app/dashboard/page.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('    <Link href={href} className="pos-panel rounded-xl p-4 hover:bg-foreground/5 transition block">\n    <Link href={href} prefetch={true}', '    <Link href={href} prefetch={true}');
  content = content.replace('    return <Link href={href}>{content}</Link>\n    return <Link href={href} prefetch={true}>{content}</Link>', '    return <Link href={href} prefetch={true}>{content}</Link>');
  fs.writeFileSync(file, content);
}

fixOrderSummary();
fixDashboard();
console.log('Fixed order summary and dashboard');
