##
##Commands
##-------------

generate-gif: ## generate-gif
	mkdir -p assets/output
	ffmpeg -i assets/github.mov -vf scale=838:-1 -r 10 -pix_fmt rgb24 assets/output/github%3d.png
	convert -delay 10 -loop 0 assets/output/github*.png assets/github.gif
	rm -rf assets/output

# DEFAULT
.DEFAULT_GOAL := help
help:
	@grep -E '(^[a-zA-Z_-]+:.*?##.*$$)|(^##)' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[32m%-30s\033[0m %s\n", $$1, $$2}' | sed -e 's/\[32m##/[33m/'
.PHONY: help

##
