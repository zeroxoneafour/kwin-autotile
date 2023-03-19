NAME = autotile
VERSION = 0.3.0

PKGFILE = $(NAME).kwinscript
PKGDIR = pkg


build: res src
	zip -r $(PKGFILE) $(PKGDIR)

install: $(PKGFILE)
	kpackagetool5 -t KWin/Script -s $(NAME) \
		&& kpackagetool5 -u $(PKGFILE) \
		|| kpackagetool5 -i $(PKGFILE)

clean: $(PKGDIR)
	rm -r $(PKGDIR)

cleanpkg: $(PKGFILE)
	rm $(PKGFILE)

cleanall: clean cleanpkg

res: $(PKGDIR)
	cp res/metadata.json $(PKGDIR)/
	cp res/main.xml $(PKGDIR)/contents/config/
	cp res/config.ui $(PKGDIR)/contents/ui/
	sed -i "s/%VERSION%/$(VERSION)/" $(PKGDIR)/metadata.json

src: $(PKGDIR)
	cd src; cat $(shell ls src) > ../$(PKGDIR)/contents/code/main.js

$(PKGDIR):
	mkdir -p $(PKGDIR)
	mkdir -p $(PKGDIR)/contents/code
	mkdir $(PKGDIR)/contents/config
	mkdir $(PKGDIR)/contents/ui
