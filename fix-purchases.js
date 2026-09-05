const fs = require('fs');
let content = fs.readFileSync('app/purchases/page.tsx', 'utf8');

const badBlock = `                  <div className="flex justify-end pt-2 border-t border-[var(--pos-stroke)]">
                  <div className="flex justify-end pt-4 border-t border-[var(--pos-stroke)] mt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 rounded-xl bg-pos-brand text-black text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[var(--pos-brand)]/10 flex items-center gap-2"
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-pos-brand text-black text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[var(--pos-brand)]/10 flex items-center justify-center gap-2"
                    >
                      {submitting && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Purchase
                    </button>
                  </div>`;

const goodBlock = `                  <div className="flex justify-end pt-4 border-t border-[var(--pos-stroke)] mt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-pos-brand text-black text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[var(--pos-brand)]/10 flex items-center justify-center gap-2"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Purchase
                    </button>
                  </div>`;

content = content.replace(badBlock, goodBlock);

content = content.replace(
`            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-sm mb-6 bg-foreground/5 p-1 rounded-xl">
              <TabsTrigger
                value="stock"`,
`          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-sm mb-6 bg-foreground/5 p-1 rounded-xl">
              <TabsTrigger
                value="stock"`);

content = content.replace(
`                </form>
              </DialogContent>
            </Dialog>
          </div>

            <TabsContent value="recent" className="m-0 focus-visible:outline-none">`,
`                </form>
            </TabsContent>

            <TabsContent value="recent" className="m-0 focus-visible:outline-none">`);

content = content.replace(
`              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

`,
`              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
`);

fs.writeFileSync('app/purchases/page.tsx', content);
