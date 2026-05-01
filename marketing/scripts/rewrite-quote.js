#!/usr/bin/env node
// One-shot: replace the old multi-step wizard in quote.html with the new
// single-page contact-first form. Run once; safe to re-run (idempotent — looks
// for the start marker).

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = join(__dirname, '..', 'quote.html');

const START = '<!-- ==================== QUESTIONNAIRE WIZARD ==================== -->';
const END_AFTER = '        </section>\n\n    </main>';
// New marker we'll leave in-place so we know the rewrite happened.
const NEW_MARKER = '<!-- ==================== QUOTE FORM (single-page) ==================== -->';

const NEW_BLOCK = `${NEW_MARKER}
        <section class="quote-section" id="quote-section">
            <div class="container">

                <!-- ===== Form Card ===== -->
                <div class="quote-card" id="quote-form-card">
                    <div class="quote-card-header">
                        <h2>Tell us about your project</h2>
                        <p>We'll come look at it in person and follow up with a quote within 24 hours. The more you can share now, the faster we can move.</p>
                    </div>

                    <form id="quote-form" autocomplete="on" novalidate>
                        <!-- Service category -->
                        <div class="qz-question">
                            <label class="qz-label">What kind of project? <span class="form-required">*</span></label>
                            <div class="qz-grid qz-grid--compact" id="qz-categories">
                                <button type="button" class="qz-option-card qz-chip" data-category="lawn">
                                    <span class="qz-option-icon">🌿</span>
                                    <span class="qz-option-title">Lawn Care</span>
                                </button>
                                <button type="button" class="qz-option-card qz-chip" data-category="garden">
                                    <span class="qz-option-icon">🌺</span>
                                    <span class="qz-option-title">Garden &amp; Beds</span>
                                </button>
                                <button type="button" class="qz-option-card qz-chip" data-category="hardscape">
                                    <span class="qz-option-icon">🧱</span>
                                    <span class="qz-option-title">Hardscaping</span>
                                </button>
                                <button type="button" class="qz-option-card qz-chip" data-category="cleanup">
                                    <span class="qz-option-icon">🧹</span>
                                    <span class="qz-option-title">Property Cleanup</span>
                                </button>
                                <button type="button" class="qz-option-card qz-chip" data-category="design">
                                    <span class="qz-option-icon">🎨</span>
                                    <span class="qz-option-title">Design &amp; Build</span>
                                </button>
                                <button type="button" class="qz-option-card qz-chip" data-category="other">
                                    <span class="qz-option-icon">🔧</span>
                                    <span class="qz-option-title">Something Else</span>
                                </button>
                            </div>
                            <input type="hidden" id="q-category" name="category" required />
                            <input type="hidden" id="q-categoryLabel" name="categoryLabel" />
                            <span class="form-error" id="category-error">Please pick a project type</span>
                        </div>

                        <!-- Project description (the most valuable field) -->
                        <div class="form-group">
                            <label for="q-description">Tell us about it <span class="form-required">*</span></label>
                            <textarea id="q-description" name="project_description" rows="4" required
                                placeholder="A quick description goes a long way. What are you hoping to do? Approximate size or area? Anything specific — pavers, plants, problem areas, drainage?"></textarea>
                        </div>

                        <!-- Budget + timeline (helpful but optional) -->
                        <div class="form-row">
                            <div class="form-group">
                                <label for="q-budget">Project size <span class="label-optional">(helps us prep the right crew)</span></label>
                                <select id="q-budget" name="project_budget" class="qz-select">
                                    <option value="">Not sure yet</option>
                                    <option value="under500">Under $500 — small / one-time</option>
                                    <option value="500-2k">$500 – $2,000</option>
                                    <option value="2k-10k">$2,000 – $10,000</option>
                                    <option value="10k-30k">$10,000 – $30,000</option>
                                    <option value="30k+">$30,000+</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="q-timeline">When are you hoping to start?</label>
                                <select id="q-timeline" name="project_timeline" class="qz-select">
                                    <option value="">Flexible / not sure</option>
                                    <option value="asap">As soon as possible</option>
                                    <option value="2weeks">Within 2 weeks</option>
                                    <option value="month">This month</option>
                                    <option value="summer">This summer / fall</option>
                                    <option value="exploring">Just getting estimates</option>
                                </select>
                            </div>
                        </div>

                        <!-- Address (with autocomplete) -->
                        <div class="form-group address-autocomplete-wrap">
                            <label for="q-address">Property address <span class="label-optional">(so we can scout it before calling)</span></label>
                            <div class="address-input-row">
                                <svg class="address-input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <input type="text" id="q-address" name="address" placeholder="Start typing your property address..." autocomplete="off" />
                            </div>
                            <div class="address-suggestions" id="address-suggestions"></div>
                            <div class="address-map-wrap" id="address-map-wrap" style="display:none;">
                                <div id="address-minimap" class="address-minimap"></div>
                                <div class="address-map-label" id="address-map-label"></div>
                            </div>
                        </div>

                        <!-- Photos -->
                        <div class="form-group">
                            <label for="q-photos">Add photos <span class="label-optional">(optional — up to 5; helps a lot for hardscape and design)</span></label>
                            <div class="qz-photo-upload" id="qz-photo-upload">
                                <input type="file" id="q-photos" name="photos" accept="image/*" multiple style="display:none;" />
                                <button type="button" class="qz-upload-btn" id="qz-upload-trigger">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" x2="12" y1="3" y2="15" />
                                    </svg>
                                    Choose Photos
                                </button>
                                <span class="qz-upload-hint">JPG, PNG, HEIC — max 10MB each</span>
                                <div class="qz-upload-preview" id="qz-upload-preview"></div>
                            </div>
                        </div>

                        <!-- Section divider -->
                        <div class="quote-section-divider"><span>How can we reach you?</span></div>

                        <!-- Contact info -->
                        <div class="form-row">
                            <div class="form-group">
                                <label for="q-firstName">First name <span class="form-required">*</span></label>
                                <input type="text" id="q-firstName" name="firstName" placeholder="John" autocomplete="given-name" required />
                            </div>
                            <div class="form-group">
                                <label for="q-lastName">Last name <span class="form-required">*</span></label>
                                <input type="text" id="q-lastName" name="lastName" placeholder="Doe" autocomplete="family-name" required />
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="q-email">Email <span class="form-required">*</span></label>
                                <input type="email" id="q-email" name="email" placeholder="john@example.com" autocomplete="email" required pattern="[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$" />
                                <span class="form-error" id="email-error">Please enter a valid email address</span>
                            </div>
                            <div class="form-group">
                                <label for="q-phone">Phone <span class="label-optional">(optional)</span></label>
                                <input type="tel" id="q-phone" name="phone" placeholder="(402) 555-1234" autocomplete="tel" inputmode="tel" maxlength="14" />
                                <span class="form-error" id="phone-error">Please enter a valid phone number</span>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="q-contact-method">Best way to reach you?</label>
                                <select id="q-contact-method" name="contactMethod">
                                    <option value="any">No preference</option>
                                    <option value="text">Text message</option>
                                    <option value="call">Phone call</option>
                                    <option value="email">Email</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="q-best-time">Best time of day?</label>
                                <select id="q-best-time" name="bestTime">
                                    <option value="anytime">Anytime</option>
                                    <option value="morning">Morning (8am–12pm)</option>
                                    <option value="afternoon">Afternoon (12pm–5pm)</option>
                                    <option value="evening">Evening (5pm–8pm)</option>
                                </select>
                            </div>
                        </div>

                        <!-- Cloudflare Turnstile widget mounts here when LL_CONFIG.turnstile is set. -->
                        <div class="cf-turnstile-mount" style="margin: 1rem 0;"></div>

                        <div class="qz-trust-bar">
                            <div class="trust-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                                100% free, no obligation
                            </div>
                            <div class="trust-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                Reply within 24 hours
                            </div>
                            <div class="trust-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                We come look in person
                            </div>
                        </div>

                        <button type="submit" class="form-submit quote-next-btn" id="qz-submit">
                            Request My Free Estimate
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </button>
                    </form>
                </div>

                <!-- ===== Confirmation Card (shown after submit) ===== -->
                <div class="quote-card quote-step-hidden" id="quote-confirmation">
                    <div class="quote-celebration">
                        <div class="confetti-container" id="confetti-container"></div>
                        <div class="celebration-icon">🎉</div>
                        <h2>Got it — talk soon!</h2>
                        <p class="celebration-sub">Thanks for the details. We'll review your project and reach out within <strong>24 hours</strong> to set up a property visit and send your custom quote.</p>

                        <div class="celebration-phone-card">
                            <p class="phone-label">Want to chat sooner? Give us a call or text:</p>
                            <a href="tel:+14024055475" class="phone-number">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                (402) 405-5475
                            </a>
                        </div>

                        <div class="celebration-next-steps">
                            <h3>What happens next?</h3>
                            <div class="next-steps-list">
                                <div class="next-step">
                                    <div class="next-step-num">1</div>
                                    <div>
                                        <strong>We review your details</strong>
                                        <p>We'll look at your project notes, scout the address, and prep questions for the call.</p>
                                    </div>
                                </div>
                                <div class="next-step">
                                    <div class="next-step-num">2</div>
                                    <div>
                                        <strong>We reach out within 24 hours</strong>
                                        <p>By your preferred channel — call, text, or email. We'll set up a property visit.</p>
                                    </div>
                                </div>
                                <div class="next-step">
                                    <div class="next-step-num">3</div>
                                    <div>
                                        <strong>You get a real quote</strong>
                                        <p>Tailored to your property, with no surprises and no obligation.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="celebration-actions" style="display:flex; gap:0.75rem; flex-wrap:wrap; justify-content:center; margin-top:1.5rem;">
                            <a href="/gallery.html" class="btn btn-primary">See Recent Projects</a>
                            <a href="https://www.instagram.com/lucky.landscapes/" class="btn btn-outline" target="_blank" rel="noopener">Follow on Instagram</a>
                        </div>
                    </div>
                </div>

            </div>
        </section>`;

const html = await readFile(TARGET, 'utf8');

if (html.includes(NEW_MARKER)) {
    console.log('Already migrated — quote.html has the new form. Skipping.');
    process.exit(0);
}

const startIdx = html.indexOf(START);
const endMarker = '        </section>\n\n    </main>';
const endIdx = html.indexOf(endMarker, startIdx);

if (startIdx < 0 || endIdx < 0) {
    console.error('Could not find section boundaries.');
    console.error('startIdx:', startIdx, 'endIdx:', endIdx);
    process.exit(1);
}

const before = html.substring(0, startIdx);
const after = html.substring(endIdx); // keeps "        </section>\n\n    </main>" onward

const newHtml = before + NEW_BLOCK + '\n\n    </main>' + after.substring('        </section>\n\n    </main>'.length);

await writeFile(TARGET, newHtml);

const oldLines = html.split('\n').length;
const newLines = newHtml.split('\n').length;
console.log(`Rewrote quote.html: ${oldLines} → ${newLines} lines (${Math.round((1 - newLines / oldLines) * 100)}% smaller)`);
