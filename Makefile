NAME=transcoding
VERSION=$(shell cat package.json | grep version | head -1 | sed 's/.*: "\([^"]*\)".*/\1/')
APP:=${NAME}:${VERSION}
REGISTRY_PREFIX=$(if $(REGISTRY),$(addsuffix /, $(REGISTRY)))

.PHONY: build publish clean

build:
    docker build -t ${APP} .

publish:
	docker tag ${APP} ${REGISTRY_PREFIX}${APP}
	docker push ${REGISTRY_PREFIX}${APP}

version:
	@echo ${VERSION}
